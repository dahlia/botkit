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
import type {
  Actor,
  Article,
  ChatMessage,
  Document,
  Hashtag,
  Note,
  Question,
} from "@fedify/fedify";
import type { LanguageTag } from "@phensley/language-tag";
import type {
  SessionPublishOptions,
  SessionPublishOptionsWithClass,
} from "./session.ts";
import type { Text } from "./text.ts";

/**
 * A possible message class.
 */
export type MessageClass = Article | ChatMessage | Note | Question;

/**
 * The visibility of a message.
 */
export type MessageVisibility =
  /**
   * Signifies that the message is public; it can be seen and discovered by
   * anyone.
   */
  | "public"
  /**
   * Signifies that the message is quietly public; it can be seen by anyone,
   * but it will not appear in public timelines or search results.
   */
  | "unlisted"
  /**
   * Signifies that the message is only visible to followers of the account.
   * It will not appear in public timelines or search results.
   */
  | "followers"
  /**
   * Signifies that the message is private; it can only be seen by mentioned
   * accounts.
   */
  | "direct"
  /**
   * Signifies that the message is unknown; it is not clear who can see it.
   */
  | "unknown";

/**
 * A message in the ActivityPub network.  It is a thin wrapper around
 * a Fedify object: an `Article`, a `ChatMessage`, a `Note`, or a `Question`.
 */
export interface Message<T extends MessageClass, TContextData> {
  /**
   * The underlying raw message object.
   */
  readonly raw: T;

  /**
   * The URI of the message.
   */
  readonly id: URL;

  /**
   * The actor who published the message.
   */
  readonly actor: Actor;

  /**
   * The visibility of the message.
   */
  readonly visibility: MessageVisibility;

  /**
   * The language of the message if the content is tagged with a language.
   */
  readonly language?: LanguageTag;

  /**
   * The plain text content of the message.
   */
  readonly text: string;

  /**
   * The HTML content of the message.
   */
  readonly html: string;

  /**
   * The actors mentioned in the message.
   */
  readonly mentions: readonly Actor[];

  /**
   * The hashtags used in the message.
   */
  readonly hashtags: readonly Hashtag[];

  /**
   * The media attachments of the message.
   */
  readonly attachments: readonly Document[];

  /**
   * Publishes a reply to the message.
   * @param text The content of the message.
   * @param options The options for publishing the message.
   * @returns The published message.
   */
  reply(
    text: Text<TContextData>,
    options?: SessionPublishOptions,
  ): Promise<Message<Note, TContextData>>;

  /**
   * Publishes a reply to the message.
   * @typeParam T The class of the published message.
   * @param text The content of the message.
   * @param options The options for publishing the message.
   * @returns The published message.
   */
  reply<T extends MessageClass>(
    text: Text<TContextData>,
    options?: SessionPublishOptionsWithClass<T>,
  ): Promise<Message<T, TContextData>>;
}