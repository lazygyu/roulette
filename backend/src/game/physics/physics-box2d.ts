import { IPhysics } from '../IPhysics';
import { StageDef } from '../data/maps';
import { MapEntity, MapEntityState } from '../types/MapEntity.type';
import * as fs from 'fs';
import * as path from 'path';

// 올바른 Box2D 모듈 경로로 변경
const Box2DFactory = require('box2d-wasm/dist/umd/Box2D.js');

export class Box2dPhysics implements IPhysics {
  private Box2D!: any; // typeof Box2D & EmscriptenModule;
  private gravity!: any; // Box2D.b2Vec2;
  private world!: any; // Box2D.b2World;
  private initialized: boolean = false;

  private marbleMap: { [id: number]: any } = {}; // Box2D.b2Body
  private entities: ({ body: any } & MapEntityState)[] = []; // Box2D.b2Body

  private deleteCandidates: any[] = []; // Box2D.b2Body[]

  async init(): Promise<void> {
    try {
      // WASM 파일 직접 로드
      const wasmBinary = await this.loadWasmBinary();
      this.Box2D = await Box2DFactory({ wasmBinary });
      
      this.gravity = new this.Box2D.b2Vec2(0, 10);
      this.world = new this.Box2D.b2World(this.gravity);
      this.initialized = true; // 초기화 완료 플래그 설정
      console.log('box2d ready');
    } catch (error) {
      console.error('Box2D 초기화 실패:', error);
      throw error;
    }
  }

  // WebAssembly 바이너리 파일 경로 수정
  private async loadWasmBinary(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      try {
        // 올바른 wasm 파일 경로 지정
        const wasmPath = path.resolve(__dirname, '../../../../node_modules/box2d-wasm/dist/umd/Box2D.wasm');
        console.log('Loading WASM from:', wasmPath);
        
        // 파일 존재 여부 확인
        if (!fs.existsSync(wasmPath)) {
          throw new Error(`WASM 파일을 찾을 수 없습니다: ${wasmPath}`);
        }
        
        const buffer = fs.readFileSync(wasmPath);
        resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      } catch (error) {
        reject(error);
      }
    });
  }

  clear(): void {
    this.clearEntities();
  }

  clearMarbles(): void {
    Object.values(this.marbleMap).forEach((body) => {
      this.world.DestroyBody(body);
    });
    this.marbleMap = {};
  }

  createStage(stage: StageDef): void {
    this.createEntities(stage.entities);
  }

  createEntities(entities?: MapEntity[]) {
    if (!entities) return;

    const bodyTypes = {
      static: this.Box2D.b2_staticBody,
      kinematic: this.Box2D.b2_kinematicBody,
    } as const;

    entities.forEach((entity) => {
      const bodyDef = new this.Box2D.b2BodyDef();
      bodyDef.set_type(bodyTypes[entity.type]);
      const body = this.world.CreateBody(bodyDef);

      const fixtureDef = new this.Box2D.b2FixtureDef();
      fixtureDef.set_density(entity.props.density);
      fixtureDef.set_restitution(entity.props.restitution);

      let shape;
      switch (entity.shape.type) {
        case 'box':
          shape = new this.Box2D.b2PolygonShape();
          shape.SetAsBox(
            entity.shape.width,
            entity.shape.height,
            0,
            entity.shape.rotation,
          );
          fixtureDef.set_shape(shape);
          body.CreateFixture(fixtureDef);
          break;
        case 'polyline':
          shape = new this.Box2D.b2EdgeShape();
          for (let i = 0; i < entity.shape.points.length - 1; i++) {
            const p1 = entity.shape.points[i];
            const p2 = entity.shape.points[i + 1];
            const v1 = new this.Box2D.b2Vec2(p1[0], p1[1]);
            const v2 = new this.Box2D.b2Vec2(p2[0], p2[1]);
            const edge = new this.Box2D.b2EdgeShape();
            edge.SetTwoSided(v1, v2);
            body.CreateFixture(edge, 1);
          }
          break;
        case 'circle':
          shape = new this.Box2D.b2CircleShape();
          shape.set_m_radius(entity.shape.radius);
          fixtureDef.set_shape(shape);
          body.CreateFixture(fixtureDef);
          break;
      }

      body.SetAngularVelocity(entity.props.angularVelocity);
      body.SetTransform(
        new this.Box2D.b2Vec2(entity.position.x, entity.position.y),
        0,
      );
      this.entities.push({
        body,
        x: entity.position.x,
        y: entity.position.y,
        angle: 0,
        shape: entity.shape,
        life: entity.props.life ?? -1,
      });
    });
  }

  clearEntities() {
    this.entities.forEach((entity) => {
      this.world.DestroyBody(entity.body);
    });
    this.entities = [];
  }

  createMarble(id: number, x: number, y: number, isDummy: boolean = false, initialVelocity?: { x: number; y: number }): void {
    const circleShape = new this.Box2D.b2CircleShape();
    circleShape.set_m_radius(0.25);

    const bodyDef = new this.Box2D.b2BodyDef();
    bodyDef.set_type(this.Box2D.b2_dynamicBody);
    bodyDef.set_position(new this.Box2D.b2Vec2(x, y));

    const body = this.world.CreateBody(bodyDef);
    body.CreateFixture(circleShape, 1 + Math.random()); // 무게는 기존처럼 랜덤하게 설정 (필요시 isDummy에 따라 조정 가능)

    if (isDummy) {
      body.SetAwake(true);
      body.SetEnabled(true);
      if (initialVelocity) {
        const impulse = new this.Box2D.b2Vec2(initialVelocity.x, initialVelocity.y);
        // 더미 마블은 질량이 1이라고 가정하고 힘을 가함. 실제 질량에 따라 힘 조절 필요 시 추가 로직.
        // Box2D에서는 body.GetMass()로 질량을 가져올 수 있으나, Fixture 생성 후 바로 질량이 설정되는지 확인 필요.
        // 여기서는 단순하게 고정된 힘을 가하거나, Marble 클래스에서 무게를 전달받아 사용.
        // 현재 Marble 클래스의 weight는 0.1 ~ 1 사이의 값. Box2D의 밀도와는 다름.
        // 여기서는 간단히 초기 속도 방향으로 힘을 가함. 힘의 크기는 적절히 조절.
        body.ApplyLinearImpulseToCenter(new this.Box2D.b2Vec2(initialVelocity.x * 0.1, initialVelocity.y * 0.1), true);
      }
    } else {
      body.SetAwake(false);
      body.SetEnabled(false);
    }
    this.marbleMap[id] = body;
  }

  shakeMarble(id: number): void {
    const body = this.marbleMap[id];
    if (body) {
      body.ApplyLinearImpulseToCenter(
        new this.Box2D.b2Vec2(Math.random() * 10 - 5, Math.random() * 10 - 5),
        true,
      );
    }
  }

  removeMarble(id: number): void {
    const marble = this.marbleMap[id];
    if (marble) {
      this.world.DestroyBody(marble);
      delete this.marbleMap[id];
    }
  }

  getMarblePosition(id: number): { x: number; y: number; angle: number } {
    const marble = this.marbleMap[id];
    if (marble) {
      const pos = marble.GetPosition();
      return { x: pos.x, y: pos.y, angle: marble.GetAngle() };
    } else {
      return { x: 0, y: 0, angle: 0 };
    }
  }

  getEntities(): MapEntityState[] {
    return this.entities.map((entity) => {
      return {
        ...entity,
        angle: entity.body.GetAngle(),
      };
    });
  }

  applyRadialImpulse(position: { x: number; y: number }, radius: number, force: number): void {
    const center = new this.Box2D.b2Vec2(position.x, position.y);
    const radiusSq = radius * radius;

    for (const id in this.marbleMap) {
      const body = this.marbleMap[id];
      const marblePos = body.GetPosition();
      const distVector = new this.Box2D.b2Vec2(marblePos.x - center.x, marblePos.y - center.y);
      const distSq = distVector.LengthSquared();

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        if (dist === 0) { // 중심에 있는 경우, 무작위 방향으로 힘 가하기
          const randomAngle = Math.random() * 2 * Math.PI;
          const impulse = new this.Box2D.b2Vec2(force * Math.cos(randomAngle), force * Math.sin(randomAngle));
          body.ApplyLinearImpulseToCenter(impulse, true);
        } else {
          distVector.Normalize();
          const power = 1 - (dist / radius); // 거리에 따라 힘 감소
          const impulse = new this.Box2D.b2Vec2(
            distVector.get_x() * force * power,
            distVector.get_y() * force * power,
          );
          body.ApplyLinearImpulseToCenter(impulse, true);
        }
      }
    }
  }


  start(): void {
    for (const key in this.marbleMap) {
      const marble = this.marbleMap[key];
      marble.SetAwake(true);
      marble.SetEnabled(true);
    }
  }

  step(deltaSeconds: number): void {
    this.deleteCandidates.forEach((body) => {
      this.world.DestroyBody(body);
    });
    this.deleteCandidates = [];

    if (!this.initialized || !this.world) {
      // console.warn('Box2D world not initialized, skipping step.');
      return;
    }
    this.world.Step(deltaSeconds, 6, 2);

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (entity.life > 0) {
        const edge = entity.body.GetContactList();
        if (edge.contact && edge.contact.IsTouching()) {
          this.deleteCandidates.push(entity.body);
          this.entities.splice(i, 1);
        }
      }
    }
  }
}
