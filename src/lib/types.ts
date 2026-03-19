export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  status: 'sent' | 'delivered' | 'seen';
  delivered_at: string | null;
  seen_at: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  unique_id: string;
  avatar_url: string | null;
  display_name: string | null;
  updated_at: string;
};

export type Friendship = {
  id: string;
  user_id1: string;
  user_id2: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
};
