import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('ticket_messages')
@Index('idx_ticket_messages_ticket_id', ['ticketId'])
@Index('idx_ticket_messages_sender_id', ['senderId'])
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
