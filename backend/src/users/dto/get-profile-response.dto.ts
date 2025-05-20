import { Expose } from 'class-transformer';

export class GetProfileResponseDto {
  @Expose()
  id: number;
  
  @Expose()
  username: string;
  
  @Expose()
  nickname: string;
}
