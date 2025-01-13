// BotKit by Fedify: A framework for creating ActivityPub bots
// Copyright (C) 2025 Hong Minhee <https://hongminhee.org/>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import {
  Accept,
  type Actor,
  Announce,
  type Application,
  Article,
  ChatMessage,
  type Context,
  Create,
  createFederation,
  Endpoints,
  exportJwk,
  type Federation,
  Follow,
  generateCryptoKeyPair,
  Image,
  importJwk,
  type InboxContext,
  isActor,
  type KvKey,
  type KvStore,
  type Link,
  Mention,
  type NodeInfo,
  Note,
  Object,
  type PageItems,
  PropertyValue,
  Question,
  type Recipient,
  type RequestContext,
  Service,
  type Software,
  Undo,
} from "@fedify/fedify";
import { getXForwardedRequest } from "@hongminhee/x-forwarded-fetch";
import metadata from "../deno.json" with { type: "json" };
import type { Bot, BotKvPrefixes, CreateBotOptions } from "./bot.ts";
import type {
  FollowEventHandler,
  MentionEventHandler,
  ReplyEventHandler,
  UnfollowEventHandler,
} from "./events.ts";
import { createMessage, messageClasses } from "./message-impl.ts";
import type { Message, MessageClass } from "./message.ts";
import { SessionImpl } from "./session-impl.ts";
import type { Session } from "./session.ts";
import type { Text } from "./text.ts";

export class BotImpl<TContextData> implements Bot<TContextData> {
  readonly identifier: string;
  readonly class: typeof Service | typeof Application;
  readonly username: string;
  readonly name?: string;
  readonly summary?: Text<"block", TContextData>;
  #summary: { text: string; tags: Link[] } | null;
  readonly icon?: URL;
  readonly image?: URL;
  readonly properties: Record<string, Text<"block" | "inline", TContextData>>;
  readonly kv: KvStore;
  readonly kvPrefixes: BotKvPrefixes;
  readonly software?: Software;
  readonly behindProxy: boolean;
  readonly federation: Federation<TContextData>;

  onFollow?: FollowEventHandler<TContextData>;
  onUnfollow?: UnfollowEventHandler<TContextData>;
  onMention?: MentionEventHandler<TContextData>;
  onReply?: ReplyEventHandler<TContextData>;

  constructor(options: CreateBotOptions<TContextData>) {
    this.identifier = options.identifier ?? "bot";
    this.class = options.class ?? Service;
    this.username = options.username;
    this.name = options.name;
    this.summary = options.summary;
    this.#summary = null;
    this.icon = options.icon;
    this.image = options.image;
    this.properties = options.properties ?? {};
    this.kv = options.kv;
    this.kvPrefixes = {
      keyPairs: ["_botkit", "keyPairs"],
      messages: ["_botkit", "messages"],
      followers: ["_botkit", "followers"],
      followRequests: ["_botkit", "followRequests"],
      ...options.kvPrefixes ?? {},
    };
    this.software = options.software;
    this.federation = createFederation<TContextData>({
      kv: options.kv,
      queue: options.queue,
      userAgent: {
        software: `BotKit/${metadata.version}`,
      },
    });
    this.behindProxy = options.behindProxy ?? false;
    this.initialize();
  }

  initialize(): void {
    this.federation
      .setActorDispatcher(
        "/ap/actor/{identifier}",
        this.dispatchActor.bind(this),
      )
      .mapHandle(this.mapHandle.bind(this))
      .setKeyPairsDispatcher(this.keyPairsDispatcher.bind(this));
    this.federation.setFollowersDispatcher(
      "/ap/actor/{identifier}/followers",
      this.dispatchFollowers.bind(this),
    );
    this.federation.setObjectDispatcher(
      Create,
      "/ap/create/{id}",
      this.dispatchCreate.bind(this),
    );
    this.federation.setObjectDispatcher(
      Article,
      "/ap/article/{id}",
      (ctx, values) => this.dispatchMessage(Article, ctx, values.id),
    );
    this.federation.setObjectDispatcher(
      ChatMessage,
      "/ap/chat-message/{id}",
      (ctx, values) => this.dispatchMessage(ChatMessage, ctx, values.id),
    );
    this.federation.setObjectDispatcher(
      Note,
      "/ap/note/{id}",
      (ctx, values) => this.dispatchMessage(Note, ctx, values.id),
    );
    this.federation.setObjectDispatcher(
      Question,
      "/ap/question/{id}",
      (ctx, values) => this.dispatchMessage(Question, ctx, values.id),
    );
    this.federation.setObjectDispatcher(
      Announce,
      "/ap/announce/{id}",
      this.dispatchAnnounce.bind(this),
    );
    this.federation
      .setInboxListeners("/ap/actor/{identifier}/inbox", "/ap/inbox")
      .on(Follow, this.onFollowed.bind(this))
      .on(Undo, this.onUnfollowed.bind(this))
      .on(Create, this.onCreated.bind(this));
    if (this.software != null) {
      this.federation.setNodeInfoDispatcher(
        "/nodeinfo/2.1",
        this.dispatchNodeInfo.bind(this),
      );
    }
  }

  async dispatchActor(
    ctx: Context<TContextData>,
    identifier: string,
  ): Promise<Actor | null> {
    if (this.identifier !== identifier) return null;
    const session = this.getSession(ctx);
    let summary: string | null = null;
    let tags: Link[] = [];
    if (this.summary != null) {
      if (this.#summary == null) {
        summary = "";
        for await (const chunk of this.summary.getHtml(session)) {
          summary += chunk;
        }
        for await (const tag of this.summary.getTags(session)) {
          tags.push(tag);
        }
        this.#summary = { text: summary, tags };
      } else {
        summary = this.#summary.text;
        tags = this.#summary.tags;
      }
    }
    const attachments: (Object | Link | PropertyValue)[] = [];
    for (const name in this.properties) {
      const value = this.properties[name];
      const pair = new PropertyValue({
        name,
        value: (await Array.fromAsync(value.getHtml(session))).join(""),
      });
      attachments.push(pair);
      for await (const tag of value.getTags(session)) {
        tags.push(tag);
      }
    }
    const keyPairs = await ctx.getActorKeyPairs(identifier);
    return new this.class({
      id: ctx.getActorUri(identifier),
      preferredUsername: this.username,
      name: this.name,
      summary,
      tags,
      icon: new Image({ url: this.icon }),
      image: new Image({ url: this.image }),
      attachments,
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      followers: ctx.getFollowersUri(identifier),
      publicKey: keyPairs[0].cryptographicKey,
      assertionMethods: keyPairs.map((pair) => pair.multikey),
    });
  }

  mapHandle(_ctx: Context<TContextData>, username: string): string | null {
    return username === this.username ? this.identifier : null;
  }

  async keyPairsDispatcher(
    _ctx: Context<TContextData>,
    identifier: string,
  ): Promise<CryptoKeyPair[]> {
    if (identifier !== this.identifier) return [];
    interface KeyPair {
      private: JsonWebKey;
      public: JsonWebKey;
    }
    const keyPairs = await this.kv.get<KeyPair[]>(this.kvPrefixes.keyPairs);
    if (keyPairs == null) {
      const rsa = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      const ed25519 = await generateCryptoKeyPair("Ed25519");
      const rsaPair: KeyPair = {
        private: await exportJwk(rsa.privateKey),
        public: await exportJwk(rsa.publicKey),
      };
      const ed25519Pair: KeyPair = {
        private: await exportJwk(ed25519.privateKey),
        public: await exportJwk(ed25519.publicKey),
      };
      const keyPairs = [rsaPair, ed25519Pair];
      await this.kv.set(this.kvPrefixes.keyPairs, keyPairs);
      return [rsa, ed25519];
    }
    const promises = keyPairs.map(async (pair) => ({
      privateKey: await importJwk(pair.private, "private"),
      publicKey: await importJwk(pair.public, "public"),
    }));
    return await Promise.all(promises);
  }

  async dispatchFollowers(
    ctx: Context<TContextData>,
    identifier: string,
    cursor: string | null,
  ): Promise<PageItems<Recipient> | null> {
    if (identifier !== this.identifier) return null;
    let followerIds = await this.kv.get<string[]>(this.kvPrefixes.followers) ??
      [];
    const WINDOW = 50;
    let nextCursor: string | null = null;
    if (cursor != null) {
      const index = followerIds.indexOf(cursor);
      if (index < 0) return { items: [] };
      nextCursor = followerIds[index + WINDOW] ?? null;
      followerIds = followerIds.slice(index, index + WINDOW);
    }
    const followers = (await Promise.all(
      followerIds.map(async (id) => {
        const json = await this.kv.get([...this.kvPrefixes.followers, id]);
        try {
          return await Object.fromJsonLd(json, ctx);
        } catch {
          return null;
        }
      }),
    )).filter(isActor);
    return { items: followers, nextCursor };
  }

  async dispatchCreate(
    ctx: RequestContext<TContextData>,
    values: { id: string },
  ): Promise<Create | null> {
    const json = await this.kv.get([...this.kvPrefixes.messages, values.id]);
    if (json == null) return null;
    try {
      return await Create.fromJsonLd(json, ctx);
    } catch (e) {
      if (e instanceof TypeError) return null;
      throw e;
    }
  }

  async dispatchMessage<T extends MessageClass>(
    // deno-lint-ignore no-explicit-any
    cls: new (values: any) => T,
    ctx: Context<TContextData>,
    id: string,
  ): Promise<T | null> {
    const json = await this.kv.get([...this.kvPrefixes.messages, id]);
    if (json == null) return null;
    let create: Create;
    try {
      create = await Create.fromJsonLd(json, ctx);
    } catch (e) {
      if (e instanceof TypeError) return null;
      throw e;
    }
    const object = await create.getObject(ctx);
    if (object == null || !(object instanceof cls)) return null;
    return object;
  }

  async dispatchAnnounce(
    ctx: RequestContext<TContextData>,
    values: { id: string },
  ): Promise<Announce | null> {
    const json = await this.kv.get([...this.kvPrefixes.messages, values.id]);
    if (json == null) return null;
    try {
      return await Announce.fromJsonLd(json, ctx);
    } catch (e) {
      if (e instanceof TypeError) return null;
      throw e;
    }
  }

  async onFollowed(
    ctx: InboxContext<TContextData>,
    follow: Follow,
  ): Promise<void> {
    const documentLoader = await ctx.getDocumentLoader(this);
    const follower = await follow.getActor({
      contextLoader: ctx.contextLoader,
      documentLoader,
      suppressError: true,
    });
    if (follower == null || follower.id == null) return;
    const followerKey: KvKey = [...this.kvPrefixes.followers, follower.id.href];
    await this.kv.set(
      followerKey,
      await follower.toJsonLd({
        format: "compact",
        contextLoader: ctx.contextLoader,
      }),
    );
    const lockKey: KvKey = [...this.kvPrefixes.followers, "lock"];
    const listKey: KvKey = this.kvPrefixes.followers;
    do {
      await this.kv.set(lockKey, follower.id.href);
      const list = await this.kv.get<string[]>(listKey) ?? [];
      if (!list.includes(follower.id.href)) list.push(follower.id.href);
      await this.kv.set(listKey, list);
    } while (await this.kv.get(lockKey) !== follower.id.href);
    if (follow.id != null) {
      const followRequestKey: KvKey = [
        ...this.kvPrefixes.followRequests,
        follow.id.href,
      ];
      await this.kv.set(followRequestKey, follower.id.href);
    }
    await ctx.sendActivity(
      this,
      follower,
      new Accept({
        id: new URL(`#accept/${follower.id}`, ctx.getActorUri(this.identifier)),
        actor: ctx.getActorUri(this.identifier),
        object: follow,
      }),
    );
    if (this.onFollow != null) {
      const session = this.getSession(ctx);
      await this.onFollow(session, follower);
    }
  }

  async onUnfollowed(
    ctx: InboxContext<TContextData>,
    undo: Undo,
  ): Promise<void> {
    const followId = undo.objectId;
    if (followId == null) return;
    const followRequestKey: KvKey = [
      ...this.kvPrefixes.followRequests,
      followId.href,
    ];
    const followerId = await this.kv.get<string>(followRequestKey);
    if (followerId == null) return;
    const followerKey: KvKey = [...this.kvPrefixes.followers, followerId];
    const followerJson = await this.kv.get(followerKey);
    if (followerJson == null) return;
    const follower = await Object.fromJsonLd(followerJson, ctx);
    if (follower.id?.href !== undo.actorId?.href) return;
    const lockKey: KvKey = [...this.kvPrefixes.followers, "lock"];
    const listKey: KvKey = this.kvPrefixes.followers;
    do {
      await this.kv.set(lockKey, followerId);
      let list = await this.kv.get<string[]>(listKey) ?? [];
      list = list.filter((id) => id !== followerId);
      await this.kv.set(listKey, list);
    } while (await this.kv.get(lockKey) !== followerId);
    await this.kv.delete(followerKey);
    await this.kv.delete(followRequestKey);
    if (this.onUnfollow != null) {
      const session = this.getSession(ctx);
      const follower = await undo.getActor(ctx);
      if (follower != null) {
        await this.onUnfollow(session, follower);
      }
    }
  }

  async onCreated(
    ctx: InboxContext<TContextData>,
    create: Create,
  ): Promise<void> {
    const object = await create.getObject(ctx);
    if (
      !(object instanceof Article || object instanceof ChatMessage ||
        object instanceof Note || object instanceof Question)
    ) {
      return;
    }
    const session = this.getSession(ctx);
    let messageCache: Message<MessageClass, TContextData> | null = null;
    const getMessage = async () => {
      if (messageCache != null) return messageCache;
      return messageCache = await createMessage(object, session);
    };
    const replyTarget = ctx.parseUri(object.replyTargetId);
    if (
      this.onReply != null &&
      replyTarget?.type === "object" &&
      // @ts-ignore: replyTarget.class satisfies (typeof messageClasses)[number]
      messageClasses.includes(replyTarget.class)
    ) {
      const message = await getMessage();
      await this.onReply(session, message);
    }
    for await (const tag of object.getTags(ctx)) {
      if (
        tag instanceof Mention && tag.href != null && this.onMention != null
      ) {
        const parsed = ctx.parseUri(tag.href);
        if (
          parsed?.type === "actor" && parsed.identifier === this.identifier
        ) {
          await this.onMention(session, await getMessage());
          break;
        }
      }
    }
  }

  dispatchNodeInfo(_ctx: Context<TContextData>): NodeInfo {
    return {
      software: this.software!,
      protocols: ["activitypub"],
      services: {
        outbound: ["atom1.0"], // TODO
      },
      usage: {
        users: {
          total: 1,
          activeMonth: 1, // FIXME
          activeHalfyear: 1, // FIXME
        },
        localPosts: 0, // FIXME
        localComments: 0,
      },
    };
  }

  getSession(
    origin: string | URL,
    contextData: TContextData,
  ): Session<TContextData>;
  getSession(origin: string | URL): SessionImpl<TContextData>;
  getSession(context: Context<TContextData>): SessionImpl<TContextData>;

  getSession(
    origin: string | URL | Context<TContextData>,
    contextData?: TContextData,
  ): SessionImpl<TContextData> {
    const ctx = typeof origin === "string" || origin instanceof URL
      ? this.federation.createContext(new URL(origin), contextData!)
      : origin;
    return new SessionImpl(this, ctx);
  }

  async fetch(request: Request, contextData: TContextData): Promise<Response> {
    if (this.behindProxy) {
      request = await getXForwardedRequest(request);
    }
    return await this.federation.fetch(request, { contextData });
  }
}
