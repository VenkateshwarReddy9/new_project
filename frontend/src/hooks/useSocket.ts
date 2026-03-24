import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export function useSocket(groupId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken || !groupId) return;

    const socket = io('/', {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:group', groupId);
    });

    socket.on('expense:added', () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('expense:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    });

    socket.on('expense:deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('settlement:added', () => {
      queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('member:joined', () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    });

    return () => {
      socket.emit('leave:group', groupId);
      socket.disconnect();
    };
  }, [accessToken, groupId, queryClient]);

  return socketRef.current;
}
