import type { ConnectorDef } from '../sdk';
import { googleCalendar } from './google-calendar';
import { letterboxd } from './letterboxd';
import { plex } from './plex';
import { radarr } from './radarr';
import { sabnzbd } from './sabnzbd';
import { sonarr } from './sonarr';
import { tmdb } from './tmdb';

export { googleCalendar, letterboxd, plex, radarr, sabnzbd, sonarr, tmdb };
export const FIRST_PARTY: ConnectorDef<any>[] = [radarr, sonarr, sabnzbd, plex, tmdb, letterboxd, googleCalendar];
