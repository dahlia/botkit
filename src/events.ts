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
import type { Actor } from "@fedify/fedify";
import type { Message, MessageClass } from "./message.ts";
import type { Session } from "./session.ts";

/**
 * An event handler for a follow request to the bot.
 * @typeParam TContextData The type of the context data.
 * @param session The session of the bot.
 * @param follower The follower actor.
 */
export type FollowEventHandler<TContextData> = (
  session: Session<TContextData>,
  follower: Actor,
) => void | Promise<void>;

/**
 * An event handler for an unfollow event from the bot.
 * @typeParam TContextData The type of the context data.
 * @param session The session of the bot.
 * @param follower The actor who unfollowed the bot.
 */
export type UnfollowEventHandler<TContextData> = (
  session: Session<TContextData>,
  follower: Actor,
) => void | Promise<void>;

/**
 * An event handler for a message mentioned to the bot.
 * @typeParam TContextData The type of the context data.
 * @param session The session of the bot.
 * @param message The mentioned message.
 */
export type MentionEventHandler<TContextData> = (
  session: Session<TContextData>,
  message: Message<MessageClass, TContextData>,
) => void | Promise<void>;

/**
 * An event handler for a reply to the bot.
 * @typeParam TContextData The type of the context data.
 * @param session The session of the bot.
 * @param reply The reply message.
 */
export type ReplyEventHandler<TContextData> = (
  session: Session<TContextData>,
  reply: Message<MessageClass, TContextData>,
) => void | Promise<void>;
