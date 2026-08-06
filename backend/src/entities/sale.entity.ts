import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @Column()
  productName: string;

  @Column('real')
  unitPrice: number;

  @Column('int')
  quantity: number;

  @Column('boolean', { default: false })
  isPersonal: boolean;

  @Column({ type: 'varchar', nullable: true })
  recipientName: string | null;

  /** Отложенный платёж: товар выдан, деньги ещё не получены */
  @Column('boolean', { default: false })
  isDeferred: boolean;

  /** Кто взял в долг (для отложенного платежа) */
  @Column({ type: 'varchar', nullable: true })
  debtorName: string | null;

  /** Когда отложенный платёж погашен; null = ещё не оплачен */
  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deletedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
