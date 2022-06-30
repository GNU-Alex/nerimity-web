import {createStore} from 'solid-js/store';
import { RawServer } from '../RawData';
import useChannels from './useChannels';

export type Server = RawServer & {
  hasNotifications: boolean;
}
const [servers, setServers] = createStore<Record<string, Server>>({});





const set = (server: RawServer) => 
  setServers({
    ...servers,
    [server._id]: {
      ...server,
      get hasNotifications() {
        const channels = useChannels();
        return channels.getChannelsByServerId(server._id).some(channel => channel.hasNotifications)
      }
    }
  });

const get = (serverId: string) => servers[serverId]

const array = () => Object.values(servers);

export default function useServers() {
  return {
    array,
    get,
    set
  }
}