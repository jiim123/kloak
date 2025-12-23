import { useState } from 'react';
import { Hash, Bell, Pin, Users, Search, HelpCircle, PlusCircle, Gift, Sticker, Smile, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Message {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  bannerColor: string;
  content: string;
  timestamp: Date;
}

export const ChatArea = () => {
  const [message, setMessage] = useState('');

  // Placeholder messages
  const messages: Message[] = [
    {
      id: '1',
      userId: '1',
      username: 'alice',
      bannerColor: '#5865F2',
      content: 'Hey everyone! Welcome to Nomo 👋',
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: '2',
      userId: '2',
      username: 'bob',
      bannerColor: '#57F287',
      content: 'This is awesome! Finally a private chat app.',
      timestamp: new Date(Date.now() - 1800000),
    },
    {
      id: '3',
      userId: '1',
      username: 'alice',
      bannerColor: '#5865F2',
      content: 'Right? No email, no tracking. Just pure privacy.',
      timestamp: new Date(Date.now() - 900000),
    },
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // TODO: Send message
    setMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Channel header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-foreground">general</span>
          <span className="text-muted-foreground text-sm hidden sm:inline">
            | Welcome to the general channel
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <Bell className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notification Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <Pin className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pinned Messages</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <Users className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Member List</TooltipContent>
          </Tooltip>

          <div className="relative ml-2 hidden sm:block">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search" 
              className="w-40 h-7 pl-8 text-sm bg-secondary"
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <HelpCircle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3 message-hover p-2 rounded -mx-2">
            {/* Avatar */}
            <div 
              className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: msg.bannerColor }}
            >
              {msg.username[0].toUpperCase()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-foreground hover:underline cursor-pointer">
                  {msg.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-foreground mt-0.5">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className="px-4 pb-6">
        <form onSubmit={handleSend} className="relative">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4">
            <Button type="button" variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0">
              <PlusCircle className="w-5 h-5" />
            </Button>

            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message #general"
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
            />

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button type="button" variant="ghost" size="icon" className="w-8 h-8">
                <Gift className="w-5 h-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="w-8 h-8">
                <Sticker className="w-5 h-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="w-8 h-8">
                <Smile className="w-5 h-5" />
              </Button>
              {message.trim() && (
                <Button type="submit" size="icon" className="w-8 h-8">
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};