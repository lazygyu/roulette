import { IPhysics } from '../interfaces/physics.interface';
import { StageDef } from '../types/stage.type';
import { MapEntity, MapEntityState } from '../types/map-entity.type';
import * as Matter from 'matter-js';

export class MatterPhysics implements IPhysics {
  private engine!: Matter.Engine;
  private world!: Matter.World;

  private marbleMap: { [id: number]: Matter.Body } = {};
  private entities: { body: Matter.Body, id: number, state: Omit<MapEntityState, 'body'> }[] = [];

  private deleteCandidates: Matter.Body[] = [];

  async init(): Promise<void> {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 10 },
    });
    this.world = this.engine.world;
    console.log('matter.js ready');
  }

  clear(): void {
    this.clearEntities();
  }

  clearMarbles(): void {
    Object.values(this.marbleMap).forEach((body) => {
      Matter.World.remove(this.world, body);
    });
    this.marbleMap = {};
  }

  createStage(stage: StageDef): void {
    this.createEntities(stage.entities);
  }

  createEntities(entities?: MapEntity[]) {
    if (!entities) return;

    entities.forEach((entity, index) => {
      let body: Matter.Body;

      // Matter.js에서는 body type에 대한 옵션이 다릅니다
      const options: Matter.IBodyDefinition = {
        isStatic: entity.type === 'static',
        restitution: entity.props.density,
        friction: 0.1,
        density: entity.props.density,
        angularVelocity: entity.props.angularVelocity,
        angle: 0,
        position: { x: entity.position.x, y: entity.position.y },
      };

      switch (entity.shape.type) {
        case 'box':
          body = Matter.Bodies.rectangle(
            entity.position.x,
            entity.position.y,
            entity.shape.width || 0,
            entity.shape.height || 0,
            options,
          );
          if (entity.shape.rotation) {
            Matter.Body.rotate(body, entity.shape.rotation);
          }
          break;

        case 'circle':
          body = Matter.Bodies.circle(entity.position.x, entity.position.y, entity.shape.radius || 0, options);
          break;

        case 'polyline':
          if (entity.shape.points && entity.shape.points.length > 0) {
            // 각 선분을 별도의 직사각형 바디로 생성
            const segments: Matter.Body[] = [];
            
            for (let i = 0; i < entity.shape.points.length - 1; i++) {
              const p1 = entity.shape.points[i];
              const p2 = entity.shape.points[i + 1];
              
              // 두 점 사이의 중간점 계산
              const midX = (p1[0] + p2[0]) / 2;
              const midY = (p1[1] + p2[1]) / 2;
              
              // 두 점 사이의 거리 계산
              const dx = p2[0] - p1[0];
              const dy = p2[1] - p1[1];
              const length = Math.sqrt(dx * dx + dy * dy);
              
              // 각도 계산
              const angle = Math.atan2(dy, dx);
              
              // 얇은 직사각형으로 선분 표현
              const segment = Matter.Bodies.rectangle(
                midX, 
                midY, 
                length, 
                5, 
                { 
                  angle, 
                  isStatic: options.isStatic,
                  friction: options.friction,
                  restitution: options.restitution,
                  density: options.density
                }
              );
              
              segments.push(segment);
            }
            
            // 여러 개의 선분을 하나의 복합 바디로 결합
            body = Matter.Body.create({
              parts: segments,
              position: { x: entity.position.x, y: entity.position.y }
            });
          } else {
            // 점이 없는 경우 빈 body 생성
            body = Matter.Bodies.rectangle(
              entity.position.x,
              entity.position.y,
              1,
              1, // 작은 크기의 사각형
              options
            );
          }
          break;

        default:
          // 기본 케이스로 작은 사각형 생성
          body = Matter.Bodies.rectangle(entity.position.x, entity.position.y, 1, 1, options);
      }

      Matter.World.add(this.world, body);

      // 엔티티 저장 방식 변경
      this.entities.push({
        body,
        id: index, // 고유 ID 부여
        state: {
          x: entity.position.x,
          y: entity.position.y,
          angle: 0,
          shape: entity.shape,
          life: entity.props.life ?? -1,
        }
      });
    });
  }

  clearEntities() {
    this.entities.forEach((entity) => {
      Matter.World.remove(this.world, entity.body);
    });
    this.entities = [];
  }

  createMarble(id: number, x: number, y: number): void {
    const body = Matter.Bodies.circle(x, y, 0.25, {
      restitution: 0.8,
      friction: 0.1,
      density: 1 + Math.random(),
      isSleeping: true,
    });

    Matter.World.add(this.world, body);
    this.marbleMap[id] = body;
  }

  shakeMarble(id: number): void {
    const body = this.marbleMap[id];
    if (body) {
      const forceX = (Math.random() * 10 - 5) * 0.001;
      const forceY = (Math.random() * 10 - 5) * 0.001;
      Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
    }
  }

  removeMarble(id: number): void {
    const marble = this.marbleMap[id];
    if (marble) {
      Matter.World.remove(this.world, marble);
      delete this.marbleMap[id];
    }
  }

  getMarblePosition(id: number): { x: number; y: number; angle: number } {
    const marble = this.marbleMap[id];
    if (marble) {
      return {
        x: marble.position.x,
        y: marble.position.y,
        angle: marble.angle,
      };
    } else {
      return { x: 0, y: 0, angle: 0 };
    }
  }

  getEntities(): MapEntityState[] {
    // body 객체를 포함하지 않는 간단한 상태 객체만 반환
    return this.entities.map(entity => {
      const body = entity.body;
      return {
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
        shape: entity.state.shape,
        life: entity.state.life
      };
    });
  }

  impact(id: number): void {
    const src = this.marbleMap[id];
    if (!src) return;

    Object.values(this.marbleMap).forEach((body) => {
      if (body === src) return;

      const dx = body.position.x - src.position.x;
      const dy = body.position.y - src.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < 100) {
        const dist = Math.sqrt(distSq);
        const power = (1 - dist / 10) * 0.005;

        // 방향 벡터 정규화
        const nx = dx / dist;
        const ny = dy / dist;

        // 힘 적용
        Matter.Body.applyForce(body, body.position, { x: nx * power * power * 5, y: ny * power * power * 5 });
      }
    });
  }

  start(): void {
    for (const key in this.marbleMap) {
      const marble = this.marbleMap[key];
      Matter.Sleeping.set(marble, false);
    }
  }

  step(deltaSeconds: number): void {
    // 이전에 삭제하기 위해 표시된 물체들을 제거
    this.deleteCandidates.forEach((body) => {
      Matter.World.remove(this.world, body);
    });
    this.deleteCandidates = [];

    // 물리 엔진 업데이트
    Matter.Engine.update(this.engine, deltaSeconds * 1000);

    // 충돌 감지 및 처리
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (entity.state.life > 0) {
        // Matter.js에서는 접촉 감지 방법이 다릅니다
        // Collision 이벤트를 구독해야 하지만, 여기서는 단순화를 위해
        // 엔티티의 수명이 더 오래 지속되도록 할게요
        const pairs = Matter.Query.collides(entity.body, Object.values(this.marbleMap));
        if (pairs.length > 0) {
          this.deleteCandidates.push(entity.body);
          this.entities.splice(i, 1);
        }
      }
    }
  }
}
