#!/usr/bin/env node

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set the path to the FFmpeg binary within the Node.js application
ffmpeg.setFfmpegPath(ffmpegPath);


async function getSupportedFormat() {
  const xcbgrabSupported = await checkInputFormat('xcbgrab');
  if (xcbgrabSupported) {
    return 'xcbgrab';
  }

  const x11grabSupported = await checkInputFormat('x11grab');
  if (x11grabSupported) {
    return 'x11grab';
  }

  return null;
}

function checkInputFormat(format) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    command.input(':0.0')
      .inputFormat(format)
      .on('error', (err) => {
        if (err.message.includes('input format not recognized')) {
          resolve(false);
        } else {
          reject(err);
        }
      })
      .on('end', () => {
        resolve(true);
      })
      .output('/dev/null')
      .run();
  });
}

app.get('/stream',async (req, res) => {
    const command = ffmpeg()
        .input(':10.0')
        .inputFormat(await getSupportedFormat())
        .videoCodec('libx264')
        .inputFPS(25)
        .size('1024x768')
        .outputFormat('mpegts')
        .outputOptions(['-crf 0', '-preset ultrafast'])
        .on('error', (err) => {
            console.error(`FFmpeg error: ${err.message}`);
            res.write(`FFmpeg error: ${err.message}`);
        });

    res.writeHead(200, {
        'Content-Type': 'video/mp2t',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'Content-Disposition': 'inline'
    });

    command.pipe(res, { end: true });
});

http.listen(5599, () => {
    console.log(`Screen streaming started. View scream using media player like VLC.
- http://127.0.0.1:5599/stream
- http://<your-host>:5599/stream`);
});
