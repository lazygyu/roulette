import { Expose } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GetProfileResponseDto {
  @Expose()
  id: number;
  
  @Expose()
  username: string;
  
  @Expose()
  nickname: string;
}
