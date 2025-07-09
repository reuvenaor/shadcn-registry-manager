import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"

export function spinner(
  text: string,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>,
  progressToken: string = "spinner",
  total: number = 100,
  updateRequestId?: string | number
) {
  const isExtra = extra?.sendNotification !== undefined;
  const requestId = updateRequestId || extra?.requestId;

  function notify(payload: ServerNotification | null) {
    if (!isExtra || !payload) {
      console.error("extra is required");
      return spinnerObj;
    }
    extra.sendNotification(payload);
    return spinnerObj;
  }

  const spinnerObj = {
    start: (msg?: string) =>
      notify({
        method: "notifications/progress",
        params: { progressToken, message: msg || text, progress: 0, total, requestId },
      }),
    succeed: (msg?: string) =>
      notify({
        method: "notifications/progress",
        params: { progressToken, message: msg || text, progress: 1, total, requestId },
      }),
    fail: (msg?: string) =>
      notify({
        method: "notifications/message",
        params: { level: "error", data: { text: msg || text }, requestId },
      }),
    info: (msg?: string) =>
      notify({
        method: "notifications/message",
        params: { level: "info", data: { text: msg || text }, requestId },
      }),
    warn: (msg?: string) =>
      notify({
        method: "notifications/message",
        params: { level: "warning", data: { text: msg || text }, requestId },
      }),
    stop: () =>
      notify({
        method: "notifications/message",
        params: { level: "info", data: { text: "Stopped" }, requestId },
      }),
    stopAndPersist: () =>
      notify({
        method: "notifications/message",
        params: { level: "info", data: { text: "Stopped and persisted" }, requestId },
      }),
    progress: (progress: number, message?: string) =>
      notify({
        method: "notifications/progress",
        params: { progressToken, progress, message, total, requestId },
      }),
    text,
  };

  return spinnerObj;
}
