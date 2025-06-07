import { IPhysics } from '../IPhysics';
import { StageDef } from 'common';
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

  // Helper function to destroy Box2D objects if a destroy method exists
  private destroyObject(obj: any): void {
    if (obj && typeof this.Box2D.destroy === 'function') {
      this.Box2D.destroy(obj);
    }
  }

  async init(): Promise<void> {
    try {
      // WASM 파일 직접 로드
      const wasmBinary = await this.loadWasmBinary();
      this.Box2D = await Box2DFactory({ wasmBinary });

      this.gravity = new this.Box2D.b2Vec2(0, 10);
      this.world = new this.Box2D.b2World(this.gravity);
      // Note: this.gravity is created with `new` and might need destruction.
      // However, it's often managed by the world or is a simple struct.
      // For now, we assume it doesn't need explicit destruction unless docs say otherwise.
      this.initialized = true; // 초기화 완료 플래그 설정
      // console.log('box2d ready');
    } catch (error) {
      // console.error('Box2D 초기화 실패:', error);
      throw error;
    }
  }

  // WebAssembly 바이너리 파일 경로 수정
  private async loadWasmBinary(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      let wasmPath: string = path.resolve(__dirname, '../../../assets/dist/umd/Box2D.wasm');

      if (fs.existsSync(wasmPath)) {
        try {
          const buffer = fs.readFileSync(wasmPath);
          resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`WASM 파일을 찾을 수 없습니다. 시도한 경로: ${wasmPath}`));
      }
    });
  }

  clear(): void {
    this.clearEntities(); // Clears map entities
    this.clearMarbles(); // Clears all marbles
  }

  clearMarbles(): void {
    if (!this.world) return;
    Object.values(this.marbleMap).forEach((body) => {
      this.world.DestroyBody(body);
    });
    this.marbleMap = {};
  }

  createStage(stage: StageDef): void {
    this.createEntities(stage.entities);
  }

  createEntities(entities?: MapEntity[]) {
    if (!entities || !this.world) return;

    const bodyTypes = {
      static: this.Box2D.b2_staticBody,
      kinematic: this.Box2D.b2_kinematicBody,
    } as const;

    entities.forEach((entity) => {
      const bodyDef = new this.Box2D.b2BodyDef();
      bodyDef.set_type(bodyTypes[entity.type]);
      // bodyDef.set_position(new this.Box2D.b2Vec2(entity.position.x, entity.position.y)); // Set position in bodyDef
      const body = this.world.CreateBody(bodyDef);
      this.destroyObject(bodyDef); // Destroy bodyDef after use

      const fixtureDef = new this.Box2D.b2FixtureDef();
      fixtureDef.set_density(entity.props.density);
      fixtureDef.set_restitution(entity.props.restitution);

      let shape: any;
      switch (entity.shape.type) {
        case 'box':
          shape = new this.Box2D.b2PolygonShape();
          const halfWidth = entity.shape.width / 2;
          const halfHeight = entity.shape.height / 2;
          const centerVec = new this.Box2D.b2Vec2(0, 0); // Local center of the box
          // Assuming entity.shape.rotation is the angle for the box shape itself,
          // but SetAsBox's angle parameter is often for rotating the box *within* the fixture/body.
          // If the body itself is rotated later via SetTransform, this angle might be 0.
          // For simplicity, we'll use entity.shape.rotation here.
          shape.SetAsBox(
            halfWidth,
            halfHeight,
            centerVec,
            entity.shape.rotation, // Angle for the box shape
          );
          this.destroyObject(centerVec);
          fixtureDef.set_shape(shape);
          body.CreateFixture(fixtureDef);
          this.destroyObject(shape); // Destroy shape after use
          break;
        case 'polyline':
          // For polyline, multiple fixtures (edges) might be created.
          // Each b2EdgeShape and b2Vec2 should be destroyed.
          for (let i = 0; i < entity.shape.points.length - 1; i++) {
            const p1Data = entity.shape.points[i];
            const p2Data = entity.shape.points[i + 1];
            const v1 = new this.Box2D.b2Vec2(p1Data[0], p1Data[1]);
            const v2 = new this.Box2D.b2Vec2(p2Data[0], p2Data[1]);
            const edgeShape = new this.Box2D.b2EdgeShape();
            edgeShape.SetTwoSided(v1, v2);
            body.CreateFixture(edgeShape, 0); // Static bodies typically have 0 density for fixtures
            this.destroyObject(v1);
            this.destroyObject(v2);
            this.destroyObject(edgeShape);
          }
          break;
        case 'circle':
          shape = new this.Box2D.b2CircleShape();
          shape.set_m_radius(entity.shape.radius);
          // shape.set_m_p(new this.Box2D.b2Vec2(0,0)); // Position relative to body, default (0,0)
          fixtureDef.set_shape(shape);
          body.CreateFixture(fixtureDef);
          this.destroyObject(shape); // Destroy shape after use
          break;
      }
      this.destroyObject(fixtureDef); // Destroy fixtureDef after use

      body.SetAngularVelocity(entity.props.angularVelocity);
      const initialPos = new this.Box2D.b2Vec2(entity.position.x, entity.position.y);
      // The SetTransform angle is for the body. If the shape itself has a rotation (like a box),
      // that's handled by SetAsBox. If the entity itself (as a whole) needs rotation, it's this one.
      // For boxes, entity.shape.rotation was used in SetAsBox. If the body also needs rotation,
      // it might be a different value or 0 if SetAsBox handled it.
      // Let's assume the SetAsBox rotation is the primary one for the shape, and body's initial angle is 0,
      // unless the entity definition implies a separate body rotation.
      // For polyline, entity.shape.rotation is used. For circle, it's 0.
      let bodyInitialAngle = 0;
      if (entity.shape.type === 'polyline') {
        bodyInitialAngle = entity.shape.rotation;
      } else if (entity.shape.type === 'box') {
        // If entity.shape.rotation was meant for the body, not just the box's local orientation
        // bodyInitialAngle = entity.shape.rotation; // This might double-rotate if SetAsBox also used it.
        // For now, assume SetAsBox handles box's local rotation, and body starts at 0 angle.
        bodyInitialAngle = 0;
      }
      body.SetTransform(initialPos, bodyInitialAngle);
      this.destroyObject(initialPos);

      this.entities.push({
        body,
        x: entity.position.x,
        y: entity.position.y,
        angle: body.GetAngle(), // Store the actual angle of the body after transform
        shape: entity.shape,
        life: entity.props.life ?? -1,
      });
    });
  }

  clearEntities() {
    if (!this.world) return;
    this.entities.forEach((entity) => {
      this.world.DestroyBody(entity.body);
    });
    this.entities = [];
  }

  createMarble(
    id: number,
    x: number,
    y: number,
    isDummy: boolean = false,
    initialVelocity?: { x: number; y: number },
  ): void {
    if (!this.world) return;
    const circleShape = new this.Box2D.b2CircleShape();
    circleShape.set_m_radius(0.25);

    const bodyDef = new this.Box2D.b2BodyDef();
    bodyDef.set_type(this.Box2D.b2_dynamicBody);
    bodyDef.set_bullet(true); // CCD 활성화
    const initialPos = new this.Box2D.b2Vec2(x, y);
    bodyDef.set_position(initialPos);
    this.destroyObject(initialPos);

    const body = this.world.CreateBody(bodyDef);
    this.destroyObject(bodyDef);

    // Create fixture
    const fixtureDef = new this.Box2D.b2FixtureDef();
    fixtureDef.set_shape(circleShape);
    fixtureDef.set_density(1 + Math.random()); // 무게는 기존처럼 랜덤하게 설정
    fixtureDef.set_restitution(0.3); // Add some restitution
    fixtureDef.set_friction(0.5); // Add some friction
    body.CreateFixture(fixtureDef);
    this.destroyObject(fixtureDef);
    this.destroyObject(circleShape);

    if (isDummy) {
      body.SetAwake(true);
      body.SetEnabled(true);
      if (initialVelocity) {
        const impulseVec = new this.Box2D.b2Vec2(initialVelocity.x * 0.1, initialVelocity.y * 0.1);
        body.ApplyLinearImpulseToCenter(impulseVec, true);
        this.destroyObject(impulseVec);
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
      const impulse = new this.Box2D.b2Vec2(Math.random() * 10 - 5, Math.random() * 10 - 5);
      body.ApplyLinearImpulseToCenter(impulse, true);
      this.destroyObject(impulse);
    }
  }

  removeMarble(id: number): void {
    if (!this.world) return;
    const marbleBody = this.marbleMap[id];
    if (marbleBody) {
      this.world.DestroyBody(marbleBody);
      delete this.marbleMap[id];
    }
  }

  getMarblePosition(id: number): { x: number; y: number; angle: number } {
    const marbleBody = this.marbleMap[id];
    if (marbleBody) {
      const pos = marbleBody.GetPosition();
      const angle = marbleBody.GetAngle();
      // Do not destroy pos here as it's a reference from GetPosition(), not newly created by `new`.
      // Box2D's GetPosition typically returns a pointer or a copy that JS GC handles if it's a JS object.
      // If it returns a direct C++ pointer via Embind/WebIDL, its lifetime is tied to the body or needs specific handling.
      // Assuming it's safe not to destroy `pos` based on typical Box2D JS wrapper behavior.
      return { x: pos.x, y: pos.y, angle: angle };
    } else {
      return { x: 0, y: 0, angle: 0 };
    }
  }

  getEntities(): MapEntityState[] {
    if (!this.world) return [];
    return this.entities.map((entity) => {
      const currentAngle = entity.body.GetAngle();
      // Update the stored angle if it has changed, though this is mainly for state representation
      entity.angle = currentAngle;
      return {
        // Return a copy of the state, not the internal entity object directly
        x: entity.x, // Original x, or use body.GetPosition().x if dynamic
        y: entity.y, // Original y, or use body.GetPosition().y if dynamic
        angle: currentAngle,
        shape: entity.shape,
        life: entity.life,
      };
    });
  }

  applyRadialImpulse(position: { x: number; y: number }, radius: number, force: number): void {
    if (!this.world) return;
    const center = new this.Box2D.b2Vec2(position.x, position.y);
    const radiusSq = radius * radius;

    for (const id in this.marbleMap) {
      const body = this.marbleMap[id];
      const marblePos = body.GetPosition(); // This is a b2Vec2, potentially needs destruction if it were `new`
      const distVector = new this.Box2D.b2Vec2(marblePos.x - center.x, marblePos.y - center.y);
      // this.destroyObject(marblePos); // Assuming GetPosition() returns a direct reference or JS-managed copy

      const distSq = distVector.LengthSquared();

      if (distSq < radiusSq) {
        let impulse: any;
        const dist = Math.sqrt(distSq);
        if (dist === 0) {
          const randomAngle = Math.random() * 2 * Math.PI;
          impulse = new this.Box2D.b2Vec2(force * Math.cos(randomAngle), force * Math.sin(randomAngle));
        } else {
          distVector.Normalize(); // Modifies distVector in-place
          const power = 1 - dist / radius;
          impulse = new this.Box2D.b2Vec2(distVector.get_x() * force * power, distVector.get_y() * force * power);
        }
        body.ApplyLinearImpulseToCenter(impulse, true);
        this.destroyObject(impulse);
      }
      this.destroyObject(distVector);
    }
    this.destroyObject(center);
  }

  start(): void {
    if (!this.world) return;
    for (const key in this.marbleMap) {
      const marbleBody = this.marbleMap[key];
      marbleBody.SetAwake(true);
      marbleBody.SetEnabled(true);
    }
  }

  step(deltaSeconds: number): void {
    if (!this.initialized || !this.world) {
      return;
    }

    // Destroy bodies marked for deletion in the previous step or by other logic
    this.deleteCandidates.forEach((body) => {
      this.world.DestroyBody(body);
    });
    this.deleteCandidates = [];

    this.world.Step(deltaSeconds, 6, 2); // velocityIterations, positionIterations

    // Process entities that might expire or be removed due to contact
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (entity.life > 0) {
        // Assuming life is a countdown or similar mechanism
        // Example: Check for contacts if entity should be removed on contact
        let contactEdge = entity.body.GetContactList(); // b2ContactEdge
        let shouldRemove = false;
        while (contactEdge) {
          if (contactEdge.get_contact().IsTouching()) {
            // get_contact() returns b2Contact
            shouldRemove = true;
            break;
          }
          contactEdge = contactEdge.get_next();
        }
        // Note: Box2D.destroy() should not be called on contactEdge or contact itself,
        // as these are typically managed internally by Box2D.

        if (shouldRemove) {
          this.deleteCandidates.push(entity.body); // Mark for deletion in next step
          this.entities.splice(i, 1);
        }
      }
    }
  }

  public destroy(): void {
    // console.log('Destroying Box2dPhysics...');
    if (this.world) {
      this.clearMarbles();
      this.clearEntities();

      // If Box2D provides a way to destroy the world itself.
      // This is highly dependent on the specific Box2D WASM wrapper.
      // For example, if `this.Box2D.destroy(this.world)` is available:
      // this.destroyObject(this.world);
      this.world = null;
    }

    if (this.gravity) {
      // this.destroyObject(this.gravity); // If gravity was `new` and needs destruction
      this.gravity = null;
    }

    // If the Box2D module itself has a shutdown or cleanup method
    if (this.Box2D && typeof this.Box2D.Exit === 'function') {
      // this.Box2D.Exit(); // Or similar cleanup if provided
    }
    this.Box2D = null;
    this.initialized = false;
    this.marbleMap = {};
    this.entities = [];
    this.deleteCandidates = [];
    // console.log('Box2dPhysics destroyed.');
  }
}
