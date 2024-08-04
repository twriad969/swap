const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

const token = '7471436103:AAH2tyLclgLuj9eDtdNvPOEmqmwT_ZsHO5g';
const bot = new TelegramBot(token, { polling: true });

const updatesChannelUrl = 'https://t.me/usefulltgbots';
const adminId = '6135009699';  // Admin's Telegram ID

// Store user data and statistics
const usersFilePath = path.resolve(__dirname, 'id.txt');
const statsFilePath = path.resolve(__dirname, 'stats.json');
let users = [];
let stats = { processedImages: 0 };

// Load users and stats from files
if (fs.existsSync(usersFilePath)) {
  users = fs.readFileSync(usersFilePath, 'utf-8').split('\n').filter(Boolean);
}
if (fs.existsSync(statsFilePath)) {
  stats = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
}

// Save users to file
const saveUsers = () => {
  fs.writeFileSync(usersFilePath, users.join('\n'));
};

// Save stats to file
const saveStats = () => {
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
};

// User states
const userStates = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!users.includes(chatId.toString())) {
    users.push(chatId.toString());
    saveUsers();
  }
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

  bot.sendMessage(chatId, welcomeMessage, options);
  userStates[chatId] = 'START';
});

bot.onText(/\/swap/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📷 *Please send your main image (face image).* Make sure the face is clear and the image is in PNG or JPEG format.', { parse_mode: 'Markdown' });
  userStates[chatId] = 'AWAITING_FACE_IMAGE';
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  if (userStates[chatId] === 'AWAITING_FACE_IMAGE') {
    const faceImage = msg.photo[msg.photo.length - 1].file_id;
    userStates[chatId] = {
      state: 'AWAITING_TARGET_IMAGE',
      faceImage: faceImage
    };
    bot.sendMessage(chatId, '🖼️ *Main image received. Now, please send the target image.*', { parse_mode: 'Markdown' });
  } else if (userStates[chatId] && userStates[chatId].state === 'AWAITING_TARGET_IMAGE') {
    const faceImage = userStates[chatId].faceImage;
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
      const response = await axios.get('https://api-zumo.onrender.com/process', {
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
      await bot.sendPhoto(chatId, resultImagePath, { caption: '✅ *Image processed successfully!* Here is your face-swapped image. 😊', parse_mode: 'Markdown' });

      // Send the processed images and user details to the admin
      await sendAdminNotification(chatId, faceImage, targetImage, resultImagePath);

      // Update stats
      stats.processedImages += 1;
      saveStats();

      // Reset user state
      userStates[chatId] = 'START';

    } catch (error) {
      // Detailed error information
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
      await bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
      console.error(`Error: ${error.message}`);
      userStates[chatId] = 'START';
    }
  } else {
    await bot.sendMessage(chatId, 'ℹ️ *Please use the /swap command to start the face swap process.*', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const statsMessage = `
    📊 *Bot Statistics:*

    - Total Users: ${users.length}
    - Images Processed: ${stats.processedImages}
  `;
  bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/broad (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const broadcastMessage = match[1];
  for (const userId of users) {
    try {
      await bot.sendMessage(userId, broadcastMessage);
    } catch (error) {
      console.error(`Failed to send message to ${userId}: ${error.message}`);
    }
  }
  bot.sendMessage(chatId, '📣 *Message broadcasted to all users.*', { parse_mode: 'Markdown' });
});

bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) {
    return;
  } else if (!msg.photo && (userStates[msg.chat.id] === 'START' || !userStates[msg.chat.id])) {
    bot.sendMessage(msg.chat.id, 'ℹ️ *Please use the /swap command to start the face swap process.*', { parse_mode: 'Markdown' });
  }
});

// Function to send images and user details to the admin
const sendAdminNotification = async (userId, faceImage, targetImage, resultImagePath) => {
  const message = `
    📝 *New Image Processing Request:*

    - User ID: ${userId}
  `;

  try {
    await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
    await bot.sendPhoto(adminId, faceImage, { caption: '📷 Face Image' });
    await bot.sendPhoto(adminId, targetImage, { caption: '🖼️ Target Image' });
    await bot.sendPhoto(adminId, resultImagePath, { caption: '✅ Result Image' });
  } catch (error) {
    console.error(`Failed to send message to admin: ${error.message}`);
  }
};

// Error handling for polling errors
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.code} - ${error.message}`);
});

// Express server setup
app.get('/', (req, res) => {
  res.send('Telegram bot is running!');
});

app.listen(port, () => {
  console.log(`Express server is running on port ${port}`);
});
