const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Here, you can log the error to a file or perform any other necessary action
});


const token = '7471436103:AAH2tyLclgLuj9eDtdNvPOEmqmwT_ZsHO5g'; // Replace with your bot token
const bot = new TelegramBot(token, { polling: true });

const updatesChannelUrl = 'https://t.me/usefulltgbots';
const adminIds = ['6135009699', '5777464952']; // Array of admin IDs

// Store user data and statistics
const usersFilePath = path.resolve(__dirname, 'id.txt');
const statsFilePath = path.resolve(__dirname, 'stats.json');
const balancesFilePath = path.resolve(__dirname, 'balances.json');
let users = [];
let stats = { processedImages: 0, referrals: {} }; // Include referrals
let balances = {};

// Load users, stats, and balances from files
if (fs.existsSync(usersFilePath)) {
  users = fs.readFileSync(usersFilePath, 'utf-8').split('\n').filter(Boolean);
}
if (fs.existsSync(statsFilePath)) {
  stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
}
if (fs.existsSync(balancesFilePath)) {
  balances = JSON.parse(fs.readFileSync(balancesFilePath, 'utf-8'));
}

// Save users to file
const saveUsers = () => {
  fs.writeFileSync(usersFilePath, users.join('\n'));
};

// Save stats to file
const saveStats = () => {
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
};

// Save balances to file
const saveBalances = () => {
  fs.writeFileSync(balancesFilePath, JSON.stringify(balances, null, 2));
};

// Initialize user balance
const initializeBalance = (userId) => {
  if (!balances[userId]) {
    balances[userId] = { tokens: 100, lastReset: Date.now(), lastActive: Date.now() };
  }
};

// Remove invalid user IDs
const removeInvalidUserId = (userId) => {
  users = users.filter(id => id !== userId);
  delete balances[userId];
  saveUsers();
  saveBalances();
};

// Reset daily tokens and notify users
const resetDailyTokens = () => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  for (const userId in balances) {
    const userBalance = balances[userId];
    if (now - userBalance.lastReset >= oneDay) {
      const tokensBeforeReset = userBalance.tokens;
      const tokensToAdd = Math.min(100, 100 - tokensBeforeReset); // Ensure the tokens don't exceed 100
      if (tokensToAdd > 0) {
        userBalance.tokens += tokensToAdd;
        userBalance.lastReset = now;
        bot.sendMessage(userId, `🎉 *Your free daily tokens have been credited!*\n\n💰 Your new balance is: ${userBalance.tokens} tokens`, { parse_mode: 'Markdown' })
          .catch((error) => {
            console.error(`Failed to send message to ${userId}: ${error.message}`);
            removeInvalidUserId(userId);
          });
      }
    }
  }
  saveBalances();
};

// User states
const userStates = {};

// Send notification to all users about new features
const notifyUsersAboutNewFeatures = (message) => {
  for (const userId of users) {
    bot.sendMessage(userId, message, { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send message to ${userId}: ${error.message}`);
        removeInvalidUserId(userId);
      });
  }
};

// Check and notify inactive users
const notifyInactiveUsers = () => {
  const now = Date.now();
  const inactivityThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
  for (const userId in balances) {
    const userBalance = balances[userId];
    if (now - userBalance.lastActive >= inactivityThreshold) {
      bot.sendMessage(userId, '👋 *We miss you!*\n\nIt looks like you haven’t used the bot in a while. Don’t forget to check out the new features we’ve added!', { parse_mode: 'Markdown' })
        .catch((error) => {
          console.error(`Failed to send inactivity notification to ${userId}: ${error.message}`);
          removeInvalidUserId(userId);
        });
    }
  }
};

// Notify users about new features when the bot starts
const newFeaturesMessage = `
🚀 *Bot Online!*

2. 🤖 *Free AI FaceSwap Bot*: Try out our new FaceSwap Bot for free and swap faces effortlessly! Just use the /swap command.

Enjoy the updates!
`;
notifyUsersAboutNewFeatures(newFeaturesMessage);

// Check for inactivity every 24 hours
setInterval(notifyInactiveUsers, 24 * 60 * 60 * 1000);

// Force user to subscribe to updates channel
const checkSubscription = async (userId) => {
  try {
    const member = await bot.getChatMember('usefulltgbots', userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (error) {
    console.error(`Failed to check subscription status for ${userId}: ${error.message}`);
    return false;
  }
};


bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = chatId.toString();

  if (!users.includes(userId)) {
    users.push(userId);
    saveUsers();
  }
  initializeBalance(userId);
  saveBalances();

  const isSubscribed = await checkSubscription(userId);

  if (isSubscribed) {
    const welcomeMessage = `
🎉 *Welcome to the AI Face Swap Bot!* 🤖

This bot allows you to swap faces in images using AI technology. Simply send your face image and the target image, and we'll swap the faces for you in seconds!

*To get started, use the command /swap and follow the instructions.*

`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Updates Channel', url: updatesChannelUrl }]
        ]
      }
    };

    bot.sendMessage(chatId, welcomeMessage, options)
      .catch((error) => {
        console.error(`Failed to send welcome message to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });

  } else {
    const subscribeMessage = `
🎉 *Welcome to the AI Face Swap Bot!* 🤖

This bot allows you to swap faces in images using AI technology. Simply send your face image and the target image, and we'll swap the faces for you in seconds!

*To get started, use the command /swap and follow the instructions.*

*You need to subscribe to the updates channel to use this bot.*

`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📢 Updates Channel', url: updatesChannelUrl }],
          [{ text: '✅ Check Subscription', callback_data: 'check_subscription' }]
        ]
      }
    };

    bot.sendMessage(chatId, subscribeMessage, options)
      .catch((error) => {
        console.error(`Failed to send subscription message to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
  }

  userStates[chatId] = 'START';
  balances[userId].lastActive = Date.now();
  saveBalances();
});

// Handle subscription check
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = chatId.toString();

  if (query.data === 'check_subscription') {
    const isSubscribed = await checkSubscription(userId);

    if (isSubscribed) {
      const successMessage = `
🎉 *Welcome to the AI Face Swap Bot!* 🤖

This bot allows you to swap faces in images using AI technology. Simply send your face image and the target image, and we'll swap the faces for you in seconds!

*To get started, use the command /swap and follow the instructions.*

      `;
      bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' })
        .catch((error) => {
          console.error(`Failed to send subscription success message to ${chatId}: ${error.message}`);
          removeInvalidUserId(chatId.toString());
        });
    } else {
      bot.sendMessage(chatId, '❌ *You are not subscribed to the updates channel.* Please subscribe and try again.', { parse_mode: 'Markdown' })
        .catch((error) => {
          console.error(`Failed to send subscription error message to ${chatId}: ${error.message}`);
          removeInvalidUserId(chatId.toString());
        });
    }
  }
});

bot.onText(/\/swap/, (msg) => {
  const chatId = msg.chat.id;
  const userId = chatId.toString();
  initializeBalance(userId);

  if (balances[userId].tokens >= 10) {
    const swapInstructions = `
📷 *Please send your main image (face image).*

1. Ensure the face is clear and well-lit.
2. The image should be in PNG or JPEG format.
3. The face should be frontal and not obstructed.
4. Avoid using images with multiple faces.
`;

    bot.sendMessage(chatId, swapInstructions, { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send swap instructions to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
    userStates[chatId] = 'AWAITING_FACE_IMAGE';
  } else {
    bot.sendMessage(chatId, '❌ *You do not have enough tokens to perform a face swap. Please use the /refer command to get more tokens. Once you finished your tokens Wait 24 hours for more 50 tokens everyday.*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send token warning to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
  }
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = chatId.toString();

  if (userStates[chatId] === 'AWAITING_FACE_IMAGE') {
    const faceImage = msg.photo[msg.photo.length - 1].file_id;
    userStates[chatId] = {
      state: 'AWAITING_TARGET_IMAGE',
      faceImage: faceImage
    };
    bot.sendMessage(chatId, '🖼️ *Main image received. Now, please send the target image.*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send message to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
  } else if (userStates[chatId] && userStates[chatId].state === 'AWAITING_TARGET_IMAGE') {
    const faceImage = userStates[chatId].faceImage;l
    const targetImage = msg.photo[msg.photo.length - 1].file_id;

    // Send progress message
    const progressMsg = await bot.sendMessage(chatId, '⏳ *Your request is being processed. Please wait a moment while we process the images.*', { parse_mode: 'Markdown' });

    // Get file URLs
    try {
      const faceImageUrl = await bot.getFileLink(faceImage);
      const targetImageUrl = await bot.getFileLink(targetImage);

      console.log(`Face Image URL: ${faceImageUrl}`);
      console.log(`Target Image URL: ${targetImageUrl}`);

      // Call the face swap API
      const response = await axios.get('https://api-wbhj.onrender.com/process', {
        params: {
          targetImageUrl,
          faceImageUrl
        }
      });

      console.log(`API Response: ${JSON.stringify(response.data)}`);

      const resultImageUrl = `https://art-global.yimeta.ai/${response.data.data.result_image}`;

      // Download the result image
      const resultImageResponse = await axios.get(resultImageUrl, { responseType: 'arraybuffer' });
      const resultImagePath = path.resolve(__dirname, 'result_image.webp');
      fs.writeFileSync(resultImagePath, resultImageResponse.data);

      // Delete the progress message
      await bot.deleteMessage(chatId, progressMsg.message_id);

      // Send the processed image to the user
      await bot.sendPhoto(chatId, resultImagePath, { caption: '✅ *Image processed successfully!* Here is your face-swapped image. 😊', parse_mode: 'Markdown' })
        .catch((error) => {
          console.error(`Failed to send photo to ${chatId}: ${error.message}`);
          removeInvalidUserId(chatId.toString());
        });

      // Send the processed images and user details to the admin
      await sendAdminNotification(chatId, faceImage, targetImage, resultImagePath);

      // Update stats
      stats.processedImages += 1;
      saveStats();

      // Deduct tokens
      balances[userId].tokens -= 10;
      saveBalances();

      // Reset user state
      userStates[chatId] = 'START';

    } catch (error) {
      const errorMsg = `
❌ *An error occurred while processing your request.*

Possible reasons:
1. Server is under high load. Please try again later.
2. The images you provided are not clear enough.
3. The server might be experiencing technical difficulties.
4. Your internet connection might be unstable.
5. The images are not in the correct format (PNG or JPEG).

Please try again later. If the issue persists, contact support.
      `;
      await bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' })
        .catch((error) => {
          console.error(`Failed to send error message to ${chatId}: ${error.message}`);
          removeInvalidUserId(chatId.toString());
        });
      userStates[chatId] = 'START';
    }
  } else {
    await bot.sendMessage(chatId, 'ℹ️ *Please use the /swap command to start the face swap process.*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send message to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
  }
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

bot.onText(/\/token/, (msg) => {
  const chatId = msg.chat.id;
  const userId = chatId.toString();
  initializeBalance(userId);

  const tokenMessage = `
🎫 *Your Token Balance:*

- Tokens: ${balances[userId].tokens}

💡 *Refer users to get more tokens! Use /refer to get your unique referral link.*
  `;
  bot.sendMessage(chatId, tokenMessage, { parse_mode: 'Markdown' })
    .catch((error) => {
      console.error(`Failed to send token message to ${chatId}: ${error.message}`);
      removeInvalidUserId(chatId.toString());
    });
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

bot.onText(/\/refer/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = chatId.toString();
  const botUsername = 'freeaiswap_bot';
  const referralLink = `https://t.me/${botUsername}?start=r_${userId}`;

  const referMessage = `
📢 *Refer Users and Earn Tokens!*

Share your unique referral link with friends. For each user that starts the bot using your link, you will earn 100 tokens, and they will get 50 tokens!

🔗 *Your Referral Link:*
[${referralLink}](${referralLink})

📤 *How to Share:*
1. Copy the link above.
2. Share it with your friends on social media, chat groups, or anywhere you like.
3. Ask them to start the bot using your link.

*Happy Referring!*
  `;

  const options = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔗 Share Referral Link', switch_inline_query: referralLink }]
      ]
    }
  };

  await bot.sendMessage(chatId, referMessage, options)
    .catch((error) => {
      console.error(`Failed to send referral message to ${chatId}: ${error.message}`);
      removeInvalidUserId(chatId.toString());
    });
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const statsMessage = `
📊 *Bot Statistics:*

- Total Users: ${users.length}
- Images Processed: ${stats.processedImages}
  `;
  bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' })
    .catch((error) => {
      console.error(`Failed to send stats message to ${chatId}: ${error.message}`);
      removeInvalidUserId(chatId.toString());
    });
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

bot.onText(/\/leaderboard/, (msg) => {
  const chatId = msg.chat.id;

  if (Object.keys(stats.referrals).length === 0) {
    // No referrals made
    bot.sendMessage(chatId, '📊 *Leaderboard:*\n\nNo referrals have been made yet.', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send leaderboard message to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
    return;
  }

  const sortedReferrals = Object.entries(stats.referrals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Get top 5

  let leaderboardMessage = '🏆 *Top 5 Referrers:*\n\n';
  sortedReferrals.forEach(([userId, count], index) => {
    leaderboardMessage += `${index + 1}. User ID: ${userId} - Referrals: ${count}\n`;
  });

  bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' })
    .catch((error) => {
      console.error(`Failed to send leaderboard message to ${chatId}: ${error.message}`);
      removeInvalidUserId(chatId.toString());
    });
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

bot.onText(/\/broad (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const broadcastMessage = match[1];

  for (const userId of users) {
    await bot.sendMessage(userId, broadcastMessage)
      .catch((error) => {
        console.error(`Failed to send message to ${userId}: ${error.message}`);
        removeInvalidUserId(userId);
      });
  }

  bot.sendMessage(chatId, '📣 *Message broadcasted to all users.*', { parse_mode: 'Markdown' })
    .catch((error) => {
      console.error(`Failed to send broadcast confirmation to ${chatId}: ${error.message}`);
      removeInvalidUserId(chatId.toString());
    });
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

// Admin-only /bonus command
bot.onText(/\/bonus/, (msg) => {
  const chatId = msg.chat.id;

  if (!adminIds.includes(chatId.toString())) {
    bot.sendMessage(chatId, '❌ *You do not have permission to use this command.*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send permission denied message to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
    return;
  }

  let bonusCount = 0;
  for (const userId in balances) {
    if (balances[userId].tokens === 0) {
      balances[userId].tokens = 50; // Reset tokens to 50 as a bonus
      bonusCount++;
      bot.sendMessage(userId, `🎁 *You've received a bonus from the admin!*\n\n💰 Your new balance is: ${balances[userId].tokens} tokens`, { parse_mode: 'Markdown' })
        .catch((error) => {
          console.error(`Failed to send bonus message to ${userId}: ${error.message}`);
          removeInvalidUserId(userId);
        });
    }
  }

  saveBalances();
  bot.sendMessage(chatId, `🎉 *Bonus awarded to ${bonusCount} users.*`, { parse_mode: 'Markdown' })
    .catch((error) => {
      console.error(`Failed to send bonus confirmation to ${chatId}: ${error.message}`);
      removeInvalidUserId(chatId.toString());
    });
});

bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) {
    return;
  } else if (!msg.photo && (userStates[msg.chat.id] === 'START' || !userStates[msg.chat.id])) {
    bot.sendMessage(msg.chat.id, 'ℹ️ *Please use the /swap command to start the face swap process.*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send message to ${msg.chat.id}: ${error.message}`);
        removeInvalidUserId(msg.chat.id.toString());
      });
  }
});

// Function to send images and user details to the admin
const sendAdminNotification = async (userId, faceImage, targetImage, resultImagePath) => {
  const chatInfo = await bot.getChat(userId);
  const username = chatInfo.username ? `@${chatInfo.username}` : 'No username on this account';

  const message = `📝 *New Image Processing Request:*\n\n- User ID: ${userId}\n- Username: ${username}`;

  for (const adminId of adminIds) {
    try {
      // Prepare the media array
      const media = [
        {
          type: 'photo',
          media: faceImage,
          caption: '📷 Face Image',
          parse_mode: 'Markdown'
        },
        {
          type: 'photo',
          media: targetImage,
          caption: '🖼️ Target Image',
          parse_mode: 'Markdown'
        },
        {
          type: 'photo',
          media: resultImagePath,
          caption: '✅ Result Image',
          parse_mode: 'Markdown'
        }
      ];

      // Send the message and the media group
      await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      await bot.sendMediaGroup(adminId, media);

    } catch (error) {
      console.error(`Failed to send message to admin (${adminId}): ${error.message}`);
    }
  }
};

// Handle referrals
bot.onText(/\/start (r_\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1].split('_')[1];

  if (referrerId && referrerId !== chatId.toString() && users.includes(referrerId)) {
    initializeBalance(chatId.toString());
    initializeBalance(referrerId);

    balances[referrerId].tokens += 100;
    balances[chatId.toString()].tokens += 50;

    // Track referrals in stats
    if (!stats.referrals[referrerId]) {
      stats.referrals[referrerId] = 0;
    }
    stats.referrals[referrerId] += 1;

    saveBalances();
    saveStats();

    bot.sendMessage(referrerId, '🎉 *You have earned 100 tokens for referring a new user!*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send referral reward to ${referrerId}: ${error.message}`);
        removeInvalidUserId(referrerId);
      });
    bot.sendMessage(chatId, '🎉 *You have earned 50 tokens for joining through a referral link!*', { parse_mode: 'Markdown' })
      .catch((error) => {
        console.error(`Failed to send referral reward to ${chatId}: ${error.message}`);
        removeInvalidUserId(chatId.toString());
      });
  }
  balances[chatId.toString()].lastActive = Date.now();
  saveBalances();
});

// Reset daily tokens every day at midnight
setInterval(resetDailyTokens, 24 * 60 * 60 * 1000);

// Error handling for polling errors
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.code} - ${error.message}`);
});

// Express server setup
app.get('/', (req, res) => {
  res.send('Telegram bot is running!');
});

app.get('/download/:file', (req, res) => {
  const file = req.params.file;
  const filePath = path.resolve(__dirname, file);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.listen(port, () => {
  console.log(`Express server is running on port ${port}`);
});
