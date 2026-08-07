import { env } from '@probvai/core';
import { isTerminal, loadGenerationView, messageForError } from '@/lib/generation-view';
import { jsonError, requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** През колко време питаме базата за ново състояние. */
const TICK_MS = 1_000;

/** Коментар за поддържане на връзката — през прокси без него тя заспива. */
const KEEPALIVE_MS = 15_000;

/**
 * GET /api/generate/{id}/stream — живо състояние през Server-Sent Events.
 *
 * Изпраща събитие при всяка промяна и после затваря. Ако генерацията не
 * приключи до тавана от средата, праща `timeout` и затваря — интерфейсът
 * не бива да върти безкрайно.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireUser();
  if (session.response) return session.response;

  const { id } = await context.params;
  const userId = session.user.id;

  const first = await loadGenerationView(userId, id);
  if (!first) {
    return jsonError(404, 'NOT_FOUND', 'Няма такава проба.');
  }

  const encoder = new TextEncoder();
  const deadline = Date.now() + env.GENERATION_CLIENT_TIMEOUT_SECONDS * 1000;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastBeat = Date.now();

      const send = (event: string, data: unknown): void => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const close = (): void => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Клиентът вече е затворил — няма какво да правим.
        }
      };

      // Клиентът си тръгна: спираме да питаме базата.
      request.signal.addEventListener('abort', close);

      const payload = (view: NonNullable<Awaited<ReturnType<typeof loadGenerationView>>>) => ({
        ...view,
        errorMessage: messageForError(view.errorCode),
      });

      send('state', payload(first));
      if (isTerminal(first.status)) {
        close();
        return;
      }

      let previous = first.status;

      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, TICK_MS));
        if (closed) break;

        if (Date.now() > deadline) {
          send('timeout', {
            message:
              'Отне прекалено дълго. Провери пак след малко — ако не се получи, кредитът се връща.',
          });
          close();
          break;
        }

        const view = await loadGenerationView(userId, id);
        if (!view) {
          close();
          break;
        }

        if (view.status !== previous) {
          previous = view.status;
          send('state', payload(view));

          if (isTerminal(view.status)) {
            close();
            break;
          }
        } else if (Date.now() - lastBeat > KEEPALIVE_MS) {
          lastBeat = Date.now();
          // Коментарен ред — държи връзката жива, без да значи нищо.
          controller.enqueue(encoder.encode(`: ${view.elapsedSeconds}s\n\n`));
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Спира буферирането в nginx-подобни проксита — иначе събитията
      // излизат наведнъж накрая.
      'x-accel-buffering': 'no',
    },
  });
}
