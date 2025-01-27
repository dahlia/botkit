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
/** @jsx react-jsx */
/** @jsxImportSource @hono/hono/jsx */
import type { Context } from "@fedify/fedify/federation";
import {
  type Announce,
  type Create,
  getActorHandle,
  Image,
  Link,
  type Object,
  PUBLIC_COLLECTION,
} from "@fedify/fedify/vocab";
import { Hono } from "@hono/hono";
import { unescape } from "@std/html/entities";
import type { BotImpl } from "./bot-impl.ts";
import { Layout } from "./components/Layout.tsx";
import { Message } from "./components/Message.tsx";
import { getMessageClass, isMessageObject, textXss } from "./message-impl.ts";
import type { MessageClass } from "./message.ts";
import type { Uuid } from "./repository.ts";

export interface Bindings {
  readonly bot: BotImpl<unknown>;
  readonly contextData: unknown;
}

export interface Env {
  readonly Bindings: Bindings;
}

export const app = new Hono<Env>();

app.get("/", async (c) => {
  const { bot } = c.env;
  const ctx = bot.federation.createContext(c.req.raw, c.env.contextData);
  const session = bot.getSession(ctx);
  const url = new URL(c.req.url);
  const handle = `@${bot.username}@${url.host}`;
  const icon = bot.icon instanceof Image
    ? bot.icon.url instanceof Link ? bot.icon.url.href : bot.icon.url
    : bot.icon;
  const iconWidth = bot.icon instanceof Image ? bot.icon.width : null;
  const iconHeight = bot.icon instanceof Image ? bot.icon.height : null;
  const image = bot.image instanceof Image
    ? bot.image.url instanceof Link ? bot.image.url.href : bot.image.url
    : bot.image;
  const imageWidth = bot.image instanceof Image ? bot.image.width : null;
  const imageHeight = bot.image instanceof Image ? bot.image.height : null;
  const followersCount = await bot.repository.countFollowers();
  const summaryChunks = bot.summary?.getHtml(session);
  const postsCount = await bot.repository.countMessages();
  const summary = summaryChunks == null
    ? null
    : (await Array.fromAsync(summaryChunks)).join("");
  const properties: Record<string, string> = {};
  for (const name in bot.properties) {
    const value = bot.properties[name];
    const valueHtml = (await Array.fromAsync(value.getHtml(session))).join("");
    properties[name] = valueHtml;
  }
  const offset = c.req.query("offset");
  const { posts: messages, nextPost } = await getPosts(
    bot,
    ctx,
    offset ? Temporal.Instant.from(offset) : undefined,
  );
  const activityLink = ctx.getActorUri(bot.identifier);
  const feedLink = new URL("/feed.xml", url);
  let nextLink: URL | undefined;
  if (nextPost?.published != null) {
    nextLink = new URL("/", url);
    nextLink.searchParams.set("offset", nextPost.published.toString());
  }
  return c.html(
    <Layout
      bot={bot}
      host={url.host}
      activityLink={activityLink}
      feedLink={feedLink}
    >
      <header class="container">
        {image && (
          <img
            src={image.href}
            width={imageWidth ?? undefined}
            height={imageHeight ?? undefined}
            alt={image instanceof Image
              ? image.name?.toString() ?? undefined
              : undefined}
            style="width: 100%; margin-bottom: 1em;"
          />
        )}
        <hgroup>
          {icon && (
            <img
              src={icon.href}
              width={iconWidth ?? undefined}
              height={iconHeight ?? undefined}
              style="float: left; margin-right: 1em; height: 72;"
            />
          )}
          <h1>
            <a href="/">{bot.name ?? bot.username}</a>
          </h1>
          <p>
            <span style="user-select: all;">{handle}</span> &middot;{" "}
            <a
              href="/feed.xml"
              rel="alternate"
              type="application/atom+xml"
              title="Atom feed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={18}
                height={18}
                viewBox="0 0 16 16"
                aria-label="Atom feed"
              >
                <path
                  fill="currentColor"
                  d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm1.5 2.5c5.523 0 10 4.477 10 10a1 1 0 1 1-2 0a8 8 0 0 0-8-8a1 1 0 0 1 0-2m0 4a6 6 0 0 1 6 6a1 1 0 1 1-2 0a4 4 0 0 0-4-4a1 1 0 0 1 0-2m.5 7a1.5 1.5 0 1 1 0-3a1.5 1.5 0 0 1 0 3"
                >
                </path>
              </svg>
            </a>{" "}
            &middot;{" "}
            <span>
              {followersCount === 1
                ? `1 follower`
                : `${followersCount.toLocaleString("en")} followers`}
            </span>{" "}
            &middot;{" "}
            <span>
              {postsCount === 1
                ? `1 post`
                : `${postsCount.toLocaleString("en")} posts`}
            </span>
            {" "}
          </p>
        </hgroup>
        {summary &&
          (
            <div
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          )}
        {globalThis.Object.keys(properties).length > 0 && (
          <table>
            <tbody>
              {globalThis.Object.entries(properties).map(([name, value]) => (
                <tr>
                  <th scope="row" style="width: 1%; white-space: nowrap;">
                    <strong>{name}</strong>
                  </th>
                  <td
                    dangerouslySetInnerHTML={{ __html: value }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </header>
      <main class="container">
        {messages.map((message) => (
          <Message message={message} session={session} />
        ))}
      </main>
      <footer class="container">
        <nav style="display: block; text-align: end;">
          {nextLink && (
            <a rel="next" href={nextLink.href}>
              Older posts &rarr;
            </a>
          )}
        </nav>
      </footer>
    </Layout>,
    {
      headers: {
        Link:
          `<${activityLink.href}>; rel="alternate"; type="application/activity+json", ` +
          `<${feedLink.href}>; rel="alternate"; type="application/atom+xml"` +
          (nextLink
            ? `, <${nextLink.href}>; rel="next"; type="text/html"`
            : ""),
      },
    },
  );
});

app.get("/message/:id", async (c) => {
  const id = c.req.param("id");
  const { bot } = c.env;
  const url = new URL(c.req.url);
  const ctx = bot.federation.createContext(c.req.raw, c.env.contextData);
  const session = bot.getSession(ctx);
  const post = await bot.repository.getMessage(id as Uuid);
  if (post == null || !isPublic(post)) return c.notFound();
  const message = await post.getObject(ctx);
  if (message == null || !isMessageObject(message)) return c.notFound();
  const activityLink = ctx.getObjectUri<MessageClass>(
    getMessageClass(message),
    { id },
  );
  const feedLink = new URL("/feed.xml", url);
  return c.html(
    <Layout
      bot={bot}
      host={url.host}
      activityLink={activityLink}
      feedLink={feedLink}
    >
      <main class="container">
        <Message message={message} session={session} />
      </main>
    </Layout>,
    {
      headers: {
        Link:
          `<${activityLink.href}>; rel="alternate"; type="application/activity+json", ` +
          `<${feedLink.href}>; rel="alternate"; type="application/atom+xml"`,
      },
    },
  );
});

app.get("/feed.xml", async (c) => {
  const { bot } = c.env;
  const url = new URL(c.req.url);
  const ctx = bot.federation.createContext(c.req.raw, c.env.contextData);
  const session = bot.getSession(ctx);
  const { posts } = await getPosts(bot, ctx, undefined, 30);
  const botName = bot.name ?? bot.username;
  const canonicalUrl = new URL("/feed.xml", url);
  const profileUrl = new URL("/", url);
  const actorUrl = ctx.getActorUri(bot.identifier);
  c.header(
    "Link",
    `<${actorUrl.href}>; rel="alternate"; type="application/activity+json", ` +
      `<${profileUrl.href}>; rel="alternate"; type="text/html"`,
  );
  const response = await c.render(
    <feed xmlns="http://www.w3.org/2005/Atom">
      <id>{canonicalUrl.href}</id>
      <link rel="self" type="application/atom+xml" href={canonicalUrl.href} />
      <link rel="alternate" type="text/html" href={profileUrl.href} />
      <link
        rel="alternate"
        type="application/activity+json"
        href={actorUrl.href}
      />
      <title>{botName} (@{bot.username}@{url.host})</title>
      <author>
        <name>{botName}</name>
        <uri>{profileUrl.href}</uri>
      </author>
      {posts.length > 0 && (
        <updated>
          {(posts[0].updated ?? posts[0].published)?.toString()}
        </updated>
      )}
      {posts.map(async (post) => {
        const activityUrl = post.id;
        if (activityUrl == null) return undefined;
        const permalink =
          (post.url instanceof Link ? post.url.href : post.url) ?? activityUrl;
        const author = post.attributionId?.href === session.actorId?.href
          ? await session.getActor()
          : await post.getAttribution({
            documentLoader: ctx.documentLoader,
            contextLoader: ctx.contextLoader,
            suppressError: true,
          });
        const authorName = author?.name ?? author?.preferredUsername ??
          (author == null ? undefined : await getActorHandle(author));
        const authorUrl =
          (author?.url instanceof Link ? author.url.href : author?.url) ??
            author?.id;
        const updated = post.updated ?? post.published;
        let title = post.name;
        if (title == null) {
          title = post.summary ?? post.content;
          if (title != null) {
            title = unescape(textXss.process(title.toString()));
          }
        }
        return (
          <entry>
            <id>{permalink.href}</id>
            <link rel="alternate" type="text/html" href={permalink.href} />
            <link
              rel="alternate"
              type="application/activity+json"
              href={activityUrl.href}
            />
            {authorName &&
              (
                <author>
                  <name>{authorName}</name>
                  {authorUrl &&
                    <uri>{authorUrl.href}</uri>}
                </author>
              )}
            {post.published && (
              <published>{post.published.toString()}</published>
            )}
            {updated && <updated>{updated.toString()}</updated>}
            {title && <title>{title}</title>}
            {post.summary && (
              <summary type="html">{post.summary.toString()}</summary>
            )}
            {post.content && (
              <content type="html">{post.content.toString()}</content>
            )}
          </entry>
        );
      })}
    </feed>,
  );
  response.headers.set("Content-Type", "application/atom+xml; charset=utf-8");
  return response;
});

async function getPosts(
  bot: BotImpl<unknown>,
  ctx: Context<unknown>,
  offset?: Temporal.Instant,
  window = 15,
): Promise<{ posts: MessageClass[]; nextPost?: Object }> {
  let posts = await Array.fromAsync(
    bot.repository.getMessages({
      order: "newest",
      until: offset,
      limit: window * 2,
    }),
  );
  let lastPost: Announce | Create | undefined = posts[posts.length - 1];
  posts = posts.slice(0, posts.length - 1);
  posts = posts.filter(isPublic);
  while (lastPost != null && posts.length < window) {
    const limit = (window - posts.length) * 2;
    const until = lastPost.published ??
      (await lastPost.getObject(ctx))?.published ??
      undefined;
    if (until == null) break;
    const nextPosts = bot.repository.getMessages({
      order: "newest",
      until,
      limit,
    });
    let i = 0;
    lastPost = undefined;
    for await (const post of nextPosts) {
      if (isPublic(post) && posts.length < window + 1) posts.push(post);
      lastPost = post;
      i++;
    }
    if (i < limit) break;
  }
  const nextPost: Object | undefined = await posts[window]?.getObject(ctx) ??
    undefined;
  posts = posts.slice(0, window);
  const messages = (await Promise.all(posts.map((p) => p.getObject(ctx))))
    .filter(isMessageObject);
  return { posts: messages, nextPost };
}

function isPublic(post: Create | Announce): boolean {
  return post.toIds.some((url) => url.href === PUBLIC_COLLECTION.href) ||
    post.ccIds.some((url) => url.href === PUBLIC_COLLECTION.href);
}
