---
description: >-
  The Message object represents a message that is published to the fediverse.
  Learn what things you can do with the Message object.
---

Message
=======

The `Message` object is a representation of a message that is published to
the fediverse.  You can interact with the `Message` object such as [replying
to it](#replying-to-a-message), [sharing it](#sharing-a-message), [deleting
it](#deleting-a-message), and so on.


Where to get a `Message` object
-------------------------------

There are two ways to get a `Message` object in general:

### Event handler

When you receive a message from the fediverse, you can get a `Message`
object from the event handler.  For example, in the following code snippet,
the `~Bot.onMention` event handler is called with a `Message` object:

~~~~ typescript
import { createBot } from "@fedify/bot";

const bot = createBot<void>({
  // Omitted other options for brevity
});

bot.onMention = async (session, message) => {
  // `message` is a `Message` object
};
~~~~

### Session

When you publish a new message to the fediverse, you can get a `Message` object
as a return value of the invoked method.  For example, in the following code
snippet, the `Session.publish()` method returns a `Message` object:

~~~~ typescript
const session = bot.getSession("https://mydomain");
const message = await session.publish(text`Hello, world!`);  // [!code highlight]
~~~~

For more information about publishing a message, see the section right below.


Publishing a message
--------------------

You can publish a message to the fediverse by calling the `Session.publish()`
method:

~~~~ typescript
await session.publish(text`Hello, world!`);
~~~~

As you can see, the `~Session.publish()` method does not take a string,
but a `Text` object.  The `Text` object can be instantiated by the `text()`
string template tag.  Texts can include emphases, links, mentions, and so on:

~~~~ typescript
await session.publish(text`
  ${link("BotKit", "https://botkit.fedify.dev/")} is a framework for \
  creating ${em("ActivityPub")} bots. It is powered by \
  ${mention("@fedify@hollo.social")}.
`);
~~~~

For more information about the `Text` object, see the [*Text*
section](./text.md).

The `Session.publish()` method returns a `Message` object that represents
the message that was published.  You can use this object to interact with
the message, such as [deleting](./message.md#deleting-a-message) it or
[replying](./message.md#replying-to-a-message) to it:

~~~~ typescript
const message = await session.publish(
  text`This message will be deleted in a minute.`
);
setTimeout(async () => {
  await message.delete();  // [!code highlight]
}, 1000 * 60);
~~~~

For more information about the `Message` object, see the [*Message*
section](./message.md).

### Visibility

You can control the visibility of the message by providing
`~SessionPublishOptions.visibility` option.  The value of the option has to be
one of the following strings:

`"public"`
:   The message is visible to everyone, and discoverable by the public timeline.

`"unlisted"`
:   The message is visible to everyone, but not discoverable by the public
    timeline.  Corresponds to Mastodon's *quiet public*.

`"followers"`
:   The message is visible only to the followers of the bot and the mentioned
    users.

`"direct"`
:   The message is visible only to the mentioned users.  Corresponds to
    Mastodon's *specific people*.

Here's an example of publishing a direct message:

~~~~ typescript
await session.publish(text`Hello, ${mention("@fedify@hollo.social")}!`, {
  visibility: "direct",  // [!code highlight]
});
~~~~

### Attaching media

You can attach media files to a message by providing
`~SessionPublishOptions.attachments` option.  The value of the option has to be
an array of `Document` objects (which is provided by Fedify).  For example:

~~~~ typescript {2-12}
await session.publish(text`Here's a cute dino!`, {
  attachments: [
    new Image({
      mediaType: "image/png",
      url: new URL(
        "https://repository-images.githubusercontent.com/913141583/852a1091-14d5-46a0-b3bf-8d2f45ef6e7f",
      ),
      name: "BotKit logo",
      width: 1280,
      height: 640,
    }),
  ],
});
~~~~

> [!TIP]
> `Document` and its subclasses `Audio`, `Image`, and `Video` are re-exported
> by BotKit:
>
> ~~~~ typescript
> import { Audio, Document, Image, Video } from "@fedify/botkit";
> ~~~~

> [!NOTE]
> You are responsible for hosting the media files.  BotKit does not provide
> any media hosting service.
>
> Usually you would host the media files on an object storage service like
> Amazon S3, Google Cloud Storage, or a self-hosted MinIO.

> [!NOTE]
> Even though you can attach unlimited number of media files to a message,
> in practice, Mastodon et al. limit the number of attachments to 4 or 5.
> Also note that the most of the fediverse servers have a limit on
> the size of the media files.  Media files reaching those limits usually
> are silently ignored by the servers.

### Language hint

You can provide a hint to the fediverse about the language of the message by
providing `~SessionPublishOptions.language` option.  The value of the option
has to be an [BCP 47], e.g., `"en"` for English, `"en-US"` for American English,
`"zh-Hant"` for Traditional Chinese.

Here's an example of publishing a message with the language hint:

~~~~ typescript
await session.publish(text`你好，世界！`, {
  language: "zh",  // [!code highlight]
});
~~~~

> [!TIP]
> We highly recommend to provide the language hint to the fediverse.  It helps
> the fediverse servers to render the message correctly, especially for the
> right-to-left languages like Arabic and Hebrew or the East Asian languages
> like Chinese, Japanese, and Korean.

[BCP 47]: https://tools.ietf.org/html/bcp47


Extracting information from a message
-------------------------------------

You can get various information about the message through the `Message` object:
the textual content, the content in HTML, the author of the message,
the timestamp when the message was created, and so on.

### Content

You can get the textual content of the message through the `~Message.text`
property.  It contains the plain text content of the message.  If the message
contains any rich text, the `~Message.text` property strips them out.
For example, if the content of the message is:

> Hello, **world**!

The `~Message.text` property will contain `"Hello, world!"`.

Recommend to use the `~Message.text` property when you need pattern matching
or text processing.

On the other hand, there is the `~Message.html` property that contains the
HTML content of the message.  It includes the rich text like emphases, links,
mentions, and so on, but dangerous HTML tags are sanitized to prevent XSS
attacks.  For example, if the content of the message is:

> Hello, **world**!

The `~Message.html` property will contain:
`"<p>Hello, <strong>world</strong>!</p>"`.

Recommend to use the `~Message.html` property when you need to render
the message in a web page.

> [!TIP]
> If you want to get the raw content of the message, which is not sanitized,
> you can use the `~Message.raw` property.

### Author

You can get the author of the message through the `~Message.actor` property.
It is represented as an `Actor` object (which is provided by Fedify).
The `Actor` object contains the information about the author, such as the
display name, the username, the avatar, and so on:

~~~~ typescript
const actor = message.actor;
console.log(actor.id);  // The URI of the author
console.log(actor.name);  // The display name of the author
console.log(actor.preferredUsername);  // The username of the author
console.log(actor.url);  // The URL of the profile of the author
console.log(actor.icon?.url);  // The URL of the avatar of the author
~~~~

### Visibility

You can get the visibility of the message through the `~Message.visibility`
property.  It is represented as a string, which is one of the following:

`"public"`
:   The message is visible to everyone, and discoverable by the public timeline.

`"unlisted"`
:   The message is visible to everyone, but not discoverable by the public
    timeline.  Corresponds to Mastodon's *quiet public*.

`"followers"`
:   The message is visible only to the followers of the bot and the mentioned
    users.

`"direct"`
:   The message is visible only to the mentioned users.  Corresponds to
    Mastodon's *specific people*.

`"unknown"`
:   The visibility of the message is unknown.  It is usually the case when
    the message is published by a minor fediverse server that is incompatible
    with Mastodon-style visibility.

### Language hint

You can get the language hint of the message through the `~Message.language`
property.  It is represented as a [`LanguageTag`] object.  If you want just
a BCP 47 language tag string, you can call the [`LanguageTag.compact()`] method:

~~~~ typescript
message.language.compact()  // e.g., "en", "en-US", "zh-Hant"
~~~~

> [!TIP]
> BotKit re-exports [`LanguageTag`] class and [`parseLanguageTag()`] function.

[`LanguageTag`]: https://phensley.github.io/cldr-engine/docs/en/api-languagetag
[`LanguageTag.compact()`]: https://phensley.github.io/cldr-engine/docs/en/api-languagetag.html#compact
[`parseLanguageTag()`]: https://phensley.github.io/cldr-engine/docs/en/api-cldrframework#parselanguagetag

### Traversing the conversation

You can get the parent message of a reply message through
the `~Message.replyTarget` property, which is either another `Message` object
or `undefined` if the message is not a reply:

~~~~ typescript
bot.onReply = async (session, reply) => {
  if (reply.replyTarget != null) {
    console.log("This is a reply to the message:", reply.replyTarget);
  }
};
~~~~

You can traverse the conversation by following the `~Message.replyTarget`
property recursively:

~~~~ typescript
bot.onReply = async (session, reply) => {
  let message: Message | undefined = reply;
  while (message != null) {
    console.log(message);
    message = message.replyTarget;
  }
};
~~~~

### Mentions

You can get the mentioned accounts in the message through
the `~Message.mentions` property.  It is an array of `Actor` objects:

~~~~ typescript
for (const mention of message.mentions) {
  console.log(mention.name);
}
~~~~

> [!TIP]
> Although the `Actor` type is declared by Fedify, it is re-exported by BotKit.

#### Hashtags

You can get the hashtags in the message through the `~Message.hashtags`
property.  It is an array of `Hashtag` objects:

~~~~ typescript
for (const hashtag of message.hashtags) {
  console.log(hashtag.name);
}
~~~~

> [!TIP]
> Although the `Hashtag` class is declared by Fedify, it is re-exported by
> BotKit.

### Attachments

You can get the attachments in the message through the `~Message.attachments`
property.  It is an array of `Document` objects:

~~~~ typescript
for (const attachment of message.attachments) {
  console.log(attachment.mediaType);
  console.log(attachment.url);
  console.log(attachment.width);
  console.log(attachment.height);
}
~~~~

> [!TIP]
> Although the `Document` class and its subclasses are declared by Fedify,
> they are re-exported by BotKit.

### Times

You can get the timestamp when the message was published through the
`~Message.published` property.  It is represented as a [`Temporal.Instant`]
object.

You can get the timestamp when the message was last updated through the
`~Message.updated` property.  It is also represented as a [`Temporal.Instant`]
object.

[`Temporal.Instant`]: https://tc39.es/proposal-temporal/docs/instant.html


Deleting a message
------------------

You can delete a message by calling the `~Message.delete()` method:

~~~~ typescript
const message = await session.publish(
  text`This message will be deleted in a minute.`
);
setTimeout(async () => {
  await message.delete();  // [!code highlight]
}, 1000 * 60);
~~~~

> [!CAUTION]
> This operation is possible if only the message is published by the same
> bot that calls the `delete()` method.  If you try to delete a message
> that is published by others, the operation will silently fail.


Replying to a message
---------------------

You can reply to a message by calling the `~Message.reply()` method:

~~~~ typescript
const message = await session.publish(
  text`This is a message that will be replied to.`
);
const reply = await message.reply(text`This is a reply to the message.`);
const reply2 = await reply.reply(text`This is a reply to the reply.`);
~~~~

You can use the same set of options as the `Session.publish()` method when
calling the `~Message.reply()` method:

~~~~ typescript
const reply = await message.reply(
  text`A reply with a language hint.`,
  { language: "en" },  // [!code highlight]
);
~~~~

> [!TIP]
> It does not mention the original author in the reply message by default.
> However, you can manually [mention them](./text.md#mentions) in the reply
> message by using the `mention()` function: 
>
> ~~~~ typescript {2}
> const reply = await message.reply(
>   text`${mention(message.actor)} This is a reply to the message.`
> );

> [!TIP]
> The visibility of the reply message is inherited from the original message
> by default.  However, you can specify the visibility of the reply message:
>
> ~~~~ typescript
> const reply = await message.reply(
>   text`This is a direct reply to the message.`,
>   { visibility: "direct" },  // [!code highlight]
> );
> ~~~~


Sharing a message
-----------------

You can share (i.e., boost) a message by calling the `~Message.share()` method:

~~~~ typescript
const message = await session.publish(
  text`This is a message that will be shared.`
);
await message.share();  // [!code highlight]
~~~~

> [!TIP]
> You can specify the visibility of the shared message:
>
> ~~~~ typescript
> await message.share({ visibility: "followers" });
> ~~~~

If you need to undo the sharing, you can call the `~SharedMessage.unshare()`
method:

~~~~ typescript
const sharedMessage = await message.share();
await sharedMessage.unshare();  // [!code highlight]
~~~~

> [!NOTE]
> `Message` and `SharedMessage` are totally different objects.  The `Message`
> object represents the original message, and the `SharedMessage` object
> represents the pointer to the original message.  Type-wise there is no
> inheritance between them.