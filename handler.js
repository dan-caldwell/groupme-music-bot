const serverless = require("serverless-http");
const express = require("express");
const app = express();
const SpotifyWebApi = require('spotify-web-api-node');
const axios = require('axios');
require('dotenv').config();

app.get("/", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from root!",
  });
});

app.post("/groupme-callback", async (req, res, next) => {

  try {
    const body = (req && req.apiGateway && req.apiGateway.event && req.apiGateway.event.body) ? req.apiGateway.event.body : {};
    const data = JSON.parse(body);
    const text = data.text;

    const spaces = text.split(' ');
    const tabs = text.split('\t');
    const newlines = text.split('\n');
    const fullText = Array.from(new Set([...spaces, ...tabs, ...newlines]));

    // Search text for Spotify track
    let matches = [];
    fullText.forEach(text => {
      const textMatches = text.match(/spotify.com\/track\/(.*)/gi);
      if (!textMatches) return;
      matches = [...matches, ...textMatches];
    });

    if (!matches.length) {
      return res.status(200).json({
        message: 'No Spotify link matches'
      });
    }

    const tracks = [...new Set(matches.map(match => {
      const removeStart = match.replace('spotify.com/track/', '');
      const trackId = removeStart.split(' ').shift().split('&').shift().split('?').shift();
      return `spotify:track:${trackId}`;
    }))];

    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(process.env.SPOTIFY_TOKEN);

    // Check if playlist already includes songs
    const playlistData = await spotifyApi.getPlaylistTracks(process.env.SPOTIFY_PLAYLIST_ID, {
      limit: 100,
      offset: 0
    });
    let songs = playlistData.body.items;
    const totalSongs = playlistData.body.total;
    const totalOffsetNeeded = Math.ceil(totalSongs / 100);

    if (totalOffsetNeeded > 1) {
      for (let i = 1; i <= totalOffsetNeeded; i++) {
        const offset = Number(`${i}00`);
        const playlistData = await spotifyApi.getPlaylistTracks(process.env.SPOTIFY_PLAYLIST_ID, {
          limit: 100,
          offset
        });
        songs = [...songs, ...playlistData.body.items];
      }
    }

    const allSongs = songs.map(song => song.track.uri);

    
    const filteredTracks = tracks.filter(track => !allSongs.includes(track));

    console.log({ tracks, filteredTracks });
    
    if (filteredTracks.length) {
      await spotifyApi.addTracksToPlaylist(process.env.SPOTIFY_PLAYLIST_ID, filteredTracks);
      return res.status(200).json({
        message: `Added ${filteredTracks.join(', ')} to playlist`
      });
    } else {
      return res.status(200).json({
        message: `Did not add any new tracks`
      });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      messsage: '500 Error'
    });
  }

});

app.get("/hello", (req, res, next) => {
  return res.status(200).json({
    message: "Hello from path!",
  });
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
