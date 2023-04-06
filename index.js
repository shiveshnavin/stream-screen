#!/usr/bin/env node
const yargs = require('yargs');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPathStatic = require('ffmpeg-static');
const { exec, spawn } = require('child_process');
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
async function getSupportedFormat(ffmpegPath) {

  try {
    const xcbgrabSupported = await checkInputFormat('xcbgrab', ffmpegPath);
    if (xcbgrabSupported) {
      return 'xcbgrab';
    }
  } catch (e) {
    console.log(e)
  }

  try {

    const x11grabSupported = await checkInputFormat('x11grab', ffmpegPath);
    if (x11grabSupported) {
      return 'x11grab';
    }
  } catch (e) {
    console.log(e)
  }

  return null;
}
getFFMPEGPath().then(ffp => {
  console.log('Using ffmpeg from', ffp)

  getSupportedFormat(ffp).then(format => {
    console.log('Supported input format', format)
  })
})


function checkInputFormat(format, ffmpegPath) {
  console.log('Checking if', format, 'is supported')
  return new Promise((resolve, reject) => {
    const cmd = spawn(ffmpegPath, ['-formats']);
    let output = '';
    cmd.stdout.on('data', (data) => {
      output += data.toString();
    });
    cmd.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    cmd.on('close', (code) => {
      if (code === 0) {
        if (output.includes(format)) {
          resolve(true);
        } else {
          resolve(false);
        }
      } else {
        reject(new Error(`ffmpeg -formats exited with code ${code}`));
      }
    });
  });
}

app.get('/stream', async (req, res) => {
  let ffPath = await getFFMPEGPath()
  ffmpeg.setFfmpegPath(ffPath)
  const command = ffmpeg()
    .input(':10.0')
    .inputFormat(await getSupportedFormat(ffPath))
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
