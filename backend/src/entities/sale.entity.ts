import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;
}
