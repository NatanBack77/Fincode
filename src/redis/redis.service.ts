import { Injectable } from '@nestjs/common';
import { Cache } from '@nestjs/cache-manager';

@Injectable()
export class RedisService {
  constructor(private cacheManeger: Cache) {}

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.cacheManeger.set(key, value, ttl);
    } else {
      await this.cacheManeger.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.cacheManeger.get(key);
  }

  async del(key: string): Promise<boolean> {
    return this.cacheManeger.del(key);
  }
}

