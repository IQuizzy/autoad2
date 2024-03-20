const { Client, ClientUser, GuildMember } = require('discord.js-selfbot-v13');
const fs = require('fs');
const { Webhook } = require('@hyunsdev/discord-webhook');
const readline = require('readline');
const client = new Client({ checkUpdate: false });
const config = require('./config.json');
const { DMChannel } = require('selfbot-discord');

process.noDeprecation = true;

const webhookname = `${config.webhookName}`;
const webhookAvatarURL = `${config.webhookAvatarURL}`;
const hook = new Webhook(config.webhookUrl, webhookname, webhookAvatarURL);

const retryDelay = config.retryDelay || 5000;

const sendMessageToChannel = (channelId, message, attachment, retryCount = 0) => {
  const channel = client.channels.cache.get(channelId);

  if (channel) {
    const mentionList = config.includeMention ? config.mentionUserIds.map(userId => `<@${userId}>`).join(' ') : '';
    if (attachment) {
      channel.send({ content: `${mentionList} ${message}`, files: [attachment] })
        .then(() => console.log(`Message with attachment sent to channel ${channel.name}`))
        .catch((error) => {
          console.error(`Failed to send message with attachment to channel ${channel.name}. Retrying in ${retryDelay / 1000} seconds. Retry count: ${retryCount}. Reason: ${error.message}`);
          setTimeout(() => sendMessageToChannel(channelId, message, attachment, retryCount + 1), retryDelay);
        });
    } else {
      channel.send(`${mentionList} ${message}`)
        .then(() => console.log(`Message sent to channel ${channel.name}`))
        .catch((error) => {
          console.error(`Failed to send message to channel ${channel.name}. Retrying in ${retryDelay / 1000} seconds. Retry count: ${retryCount}. Reason: ${error.message}`);
          setTimeout(() => sendMessageToChannel(channelId, message, attachment, retryCount + 1), retryDelay);
        });
    }
  } else {
    console.error(`Invalid channel ID for the message. Replace the ID with the correct one.`);
  }
};

const removeEveryoneHereMentions = (content) => {
  return content.replace(/@(everyone|here)/g, '');
};

const removeLinksAndInvites = (content) => {
  const withoutLinks = content.replace(/https?:\/\/[^\s]+/g, '');
  const withoutInvites = withoutLinks.replace(/(discord\.gg|discordapp\.com\/invite)\/[a-zA-Z0-9]+/g, '');
  return withoutInvites;
};

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);

  config.channels.forEach(({ id, fileName, delay, image, video }) => {
    const channel = client.channels.cache.get(id);

    if (channel) {
      try {
        const filePath = `./${fileName}.txt`;
        const message = fs.readFileSync(filePath, 'utf8').trim();
        const attachment = image ? (fs.readFileSync(`./${image}.jpg`) || fs.readFileSync(`./${image}.png`)) : null;
        const videoAttachment = video ? (fs.readFileSync(`./${video}.mp4`)) : null;
        sendMessageToChannel(id, message, attachment || videoAttachment);

        setInterval(() => {
          const delayedMessage = fs.readFileSync(filePath, 'utf8').trim();
          const delayedAttachment = image ? (fs.readFileSync(`./${image}.jpg`) || fs.readFileSync(`./${image}.png`)) : null;
          const delayedVideoAttachment = video ? (fs.readFileSync(`./${video}.mp4`)) : null;
          sendMessageToChannel(id, delayedMessage, delayedAttachment || delayedVideoAttachment);
        }, delay);
      } catch (error) {
        console.error(`Error reading file ${fileName}.txt: ${error.message}`);
      }
    } else {
      console.error();
    }
  });
});

const respondedUsers = new Set();
let lastUser = null;

client.on('messageCreate', (message) => {
  if (
    message.channel.type === 'DM' &&
    !message.author.bot &&
    message.author.id !== config.userId &&
    !respondedUsers.has(message.author.id)
  ) {
    if (message.author.id !== config.userId) {
      // check if delayed AFK message is enabled
      const isDelayedAfkMessageEnabled = config.enableDelayedAfkMessage;

      // set the delay time (in milliseconds)
      const afkMessageDelay = isDelayedAfkMessageEnabled ? Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000 : 0;

      // send the AFK message with optional delay
      setTimeout(() => {
        message.reply(config.afkMessage)
          .catch((error) => console.error(`Failed to send AFK message to user ${message.author.id}. Error: ${error.message}`));

        respondedUsers.add(message.author.id);
        console.log(`AFK message sent to user ${message.author.id}`);
      }, afkMessageDelay);
    }
  }

  if (
    message.channel.type === 'DM' &&
    !message.author.bot &&
    message.author.id !== config.userId
  ) {
    const pingOwner = `<@${config.userId}> <@${config.mainAccId}>`;
    const ownerUsername = client.users.cache.get(config.mainAccId)?.username || 'Unknown Owner';
    const cleanedMessage = removeEveryoneHereMentions(removeLinksAndInvites(message.content));

    if (message.author.id !== lastUser) {
      hook.send(`U got Message: ${cleanedMessage}\nMESSAGER: ${message.author.username} ${pingOwner}`)
        .catch((error) => console.error(`Failed to send Webhook Ping to user ${config.userId}. Error: ${error.message}`));

      console.log(`Webhook Message sent to channel my dear user ${ownerUsername}!`);
      lastUser = message.author.id;

      // Only respond once to the user
      respondedUsers.add(message.author.id);
    }
  }
});

// INSERT YOUR BOT TOKEN FROM CONFIG
client.login(config.botToken);
