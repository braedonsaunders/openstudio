// Room Invitation System Types

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export interface RoomInvitation {
  id: string;
  roomId: string;
  invitedUserId?: string;
  invitedEmail?: string;
  invitedBy: string;
  status: InvitationStatus;
  inviteCode?: string;
  message?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomInvitationWithDetails extends RoomInvitation {
  roomName: string;
  roomColor?: string;
  roomIcon?: string;
  inviterName?: string;
  inviterAvatar?: string;
  invitedUserName?: string;
  invitedUserAvatar?: string;
}

export interface PendingInvitation {
  id: string;
  roomId: string;
  roomName: string;
  roomColor?: string;
  roomIcon?: string;
  invitedBy: string;
  inviterName?: string;
  inviterAvatar?: string;
  message?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface CreateInvitationInput {
  roomId: string;
  userId?: string;
  email?: string;
  generateLink?: boolean;
  message?: string;
  expiresInHours?: number;
}

export interface CreateInvitationResponse {
  invitation: RoomInvitation;
  inviteLink?: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  roomId: string;
  role: string;
  error?: string;
}

export interface InviteLinkInfo {
  valid: boolean;
  roomId?: string;
  roomName?: string;
  roomColor?: string;
  roomIcon?: string;
  inviterName?: string;
  expiresAt?: string;
  error?: string;
}
