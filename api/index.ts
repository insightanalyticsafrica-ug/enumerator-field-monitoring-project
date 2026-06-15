import handler from "../dist/server/server.js";

export default function handlerFn(req: any, res: any) {
  return handler.fetch(req, res);
}