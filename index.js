#!/usr/bin/env node
const yargs = require('yargs');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPathStatic = require('ffmpeg-static');
const { exec } = require('child_process');
const path = require('path');


const options = yargs(process.argv.slice(2))
  .option('ffmpeg-path', {
    description: 'Path to ffmpeg',
    type: 'string',
  })
  .option('use-local-ffmpeg', {
    description: 'Use local ffmpeg',
    type: 'boolean',
  })
  .argv;

async function getFFMPEGPath() {
  let ffmpegPath
  if (options['ffmpeg-path'])
    ffmpegPath = options['ffmpeg-path']
  if (options['use-local-ffmpeg']) {
    ffmpegPath = await new Promise((resolve, reject) => {
      const command = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
      exec(command, (err, stdout, stderr) => {
        if (err) {
          reject(err);
        } else if (stderr) {
          reject(new Error(stderr.trim()));
        } else {
          const ffmpegPath = stdout.trim().split('\n')[0];
          resolve(path.resolve(ffmpegPath));
        }
      });
    });
  }
  else
    ffmpegPath = ffmpegPathStatic
  return ffmpegPath
}
async function getSupportedFormat() {

  try {
    const xcbgrabSupported = await checkInputFormat('xcbgrab');
    if (xcbgrabSupported) {
      return 'xcbgrab';
    }
  } catch (e) {
  }

  try {

    const x11grabSupported = await checkInputFormat('x11grab');
    if (x11grabSupported) {
      return 'x11grab';
    }
  } catch (e) {
  }

  return null;
}
getFFMPEGPath().then(ffp => {
  console.log('Using ffmpeg from', ffp)
})
getSupportedFormat().then(format => {
  console.log('Supported input format', format)
})
function checkInputFormat(format) {
  console.log('Checking if', format, 'is supported')
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    command.input(':10.0')
      .inputFormat(format)
      .on('error', (err) => {
        console.log(err)
        if (err.message.includes(`'${format}' is not supported`)) {
          console.log(format, 'is not supported')
          resolve(false);
        } else {
          resolve(false);
        }
      })
      .on('end', () => {
        resolve(true);
        console.log(format, 'is supported')
      })
      .output('/dev/null')
      .run();
  });
}

app.get('/stream', async (req, res) => {
  let ffPath = await getFFMPEGPath()
  ffmpeg.setFfmpegPath(ffPath)
  const command = ffmpeg()
    .input(':10.0')
    .inputFormat('xcbgrab')
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
