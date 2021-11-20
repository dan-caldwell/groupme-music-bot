const serverless = require("serverless-http");
const express = require("express");
const app = express();
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config();

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
      const trackId = removeStart
        .split('\n').shift()
        .split('\t').shift()
        .split(' ').shift()
        .split('&').shift()
        .split('?').shift();
      return `spotify:track:${trackId}`;
    }))];

    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_SECRET,
    });

    spotifyApi.setRefreshToken(process.env.SPOTIFY_REFRESH_TOKEN);
    const clientData = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(clientData.body['access_token']);

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

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

module.exports.handler = serverless(app);
