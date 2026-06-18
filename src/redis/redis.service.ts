import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

type MessageHandler = (msg: unknown) => void;

const ERROR_LOG_INTERVAL_MS = 30_000;
const BRIDGE_UNAVAILABLE =
  'Fingerprint bridge unavailable (Redis disconnected)';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly enabled: boolean;
  private readonly publisher?: Redis;
  private readonly subscriber?: Redis;
  private readonly handlers = new Map<string, Set<MessageHandler>>();
  private lastPublisherErrorAt = 0;
  private lastSubscriberErrorAt = 0;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.enabled = false;
      this.logger.warn(
        'REDIS_URL not configured — fingerprint bridge disabled; rest of API continues',
      );
      return;
    }

    this.enabled = true;
    const options = this.buildClientOptions();
    this.publisher = new Redis(redisUrl, options);
    this.subscriber = new Redis(redisUrl, options);

    this.attachClientEvents(this.publisher, 'publisher');
    this.attachClientEvents(this.subscriber, 'subscriber');

    this.subscriber.on('message', (channel, payload) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch (error) {
        this.logger.error(
          `Failed to parse message on channel "${channel}": ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }

      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) {
        return;
      }

      for (const handler of channelHandlers) {
        try {
          handler(parsed);
        } catch (error) {
          this.logger.error(
            `Handler error on channel "${channel}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });
  }

  async publish(channel: string, payload: object): Promise<void> {
    this.assertAvailable();
    try {
      await this.publisher!.publish(channel, JSON.stringify(payload));
    } catch (error) {
      throw new ServiceUnavailableException(
        `${BRIDGE_UNAVAILABLE}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    this.assertAvailable();

    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
      try {
        await this.subscriber!.subscribe(channel);
      } catch (error) {
        this.handlers.delete(channel);
        throw new ServiceUnavailableException(
          `${BRIDGE_UNAVAILABLE}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    channelHandlers.add(handler);
  }

  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    if (!this.enabled || !this.subscriber) {
      return;
    }

    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      return;
    }

    if (handler) {
      channelHandlers.delete(handler);
    } else {
      channelHandlers.clear();
    }

    if (channelHandlers.size === 0) {
      this.handlers.delete(channel);
      try {
        await this.subscriber.unsubscribe(channel);
      } catch (error) {
        this.logger.warn(
          `Failed to unsubscribe from "${channel}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await Promise.allSettled([
      this.publisher!.quit(),
      this.subscriber!.quit(),
    ]);
  }

  private assertAvailable(): void {
    if (!this.enabled || !this.publisher || !this.subscriber) {
      throw new ServiceUnavailableException(
        'Fingerprint bridge unavailable (REDIS_URL not configured)',
      );
    }

    if (
      this.publisher.status === 'end' ||
      this.subscriber.status === 'end'
    ) {
      throw new ServiceUnavailableException(BRIDGE_UNAVAILABLE);
    }
  }

  private buildClientOptions(): RedisOptions {
    return {
      // Prevent MaxRetriesPerRequestError from crashing the Node process.
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    };
  }

  private attachClientEvents(client: Redis, label: string): void {
    client.on('connect', () => {
      this.logger.log(`Redis ${label} connected`);
    });

    client.on('ready', () => {
      this.logger.log(`Redis ${label} ready`);
    });

    client.on('error', (error) => {
      this.logThrottledError(label, error);
    });

    client.on('reconnecting', () => {
      this.logger.warn(`Redis ${label} reconnecting`);
    });

    client.on('close', () => {
      this.logger.warn(`Redis ${label} connection closed`);
    });
  }

  private logThrottledError(label: string, error: Error): void {
    const now = Date.now();
    const lastAt =
      label === 'publisher'
        ? this.lastPublisherErrorAt
        : this.lastSubscriberErrorAt;

    if (now - lastAt < ERROR_LOG_INTERVAL_MS) {
      return;
    }

    if (label === 'publisher') {
      this.lastPublisherErrorAt = now;
    } else {
      this.lastSubscriberErrorAt = now;
    }

    this.logger.error(
      `Redis ${label} error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
