import { NormalizedEvent } from "./types.js";

export type EventHandler = (event: NormalizedEvent) => Promise<void> | void;

class EventBus {
  private handlers: EventHandler[] = [];

  subscribe(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  publish(event: NormalizedEvent): void {
    for (const handler of this.handlers) {
      void handler(event);
    }
  }
}

export const eventBus = new EventBus();
