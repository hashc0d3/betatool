import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('stock_changes')
export class StockChange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @Column()
  productName: string;

  @Column('int')
  oldStock: number;

  @Column('int')
  newStock: number;

  /** Логин учётной записи, изменившей количество */
  @Column()
  changedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
