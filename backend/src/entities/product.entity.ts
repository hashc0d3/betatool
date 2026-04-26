import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('real')
  price: number;

  @Column('int', { default: 0 })
  stock: number;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;
}
