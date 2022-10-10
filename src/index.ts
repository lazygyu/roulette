///<reference types="planck" /> 

const Vec2 = planck.Vec2;
const initialZoom = 30;
const canvasWidth = 1600;
const canvasHeight = 900;

const wallDefs: [number, number][][] = [
	[ 
		[9.25, 0],
		[9.25, -8.5],
		[2, -19.25],
		[2, -26],
		[9.75, -30],
		[9.75, -33.5],
		[1.25, -41],
		[1.25, -53.75],
		[8.25, -58.75],
		[8.25, -99.25],
		[15.1, -106.75],
		[15.1, -111.75]
	],
	[
		[16.5, 0],
		[16.5, -9.25],
		[9.5, -20],
		[9.5, -22.5],
		[17.5, -26],
		[17.5, -33.5],
		[24, -38.5],
		[19, -45.5],
		[19, -55.5],
		[24, -59.25],
		[24, -100.5],
		[16, -106.75],
		[16, -111.75]
	],
	[
		[12.75, -37.5],
		[7, -43.5],
		[7, -49.75],
		[12.75, -53.75],
		[12.75, -37.5]
	],
	[
		[14.75, -37.5],
		[14.75, -43],
		[17.5, -40.25],
		[14.75, -37.5]
	]
];

class Particle {
	position: planck.Vec2 = new Vec2();
	force: planck.Vec2 = new Vec2();
	color: string = '';

	constructor(x: number, y: number) {
		this.position = new Vec2(x, y);
		
		const force =  100 + Math.random() * 200;
		const ang = rad(-45 + (90 * Math.random()) - 135);
		const fx = Math.cos(ang) * force;
		const fy = Math.sin(ang) * force;
		console.log(fy);
		this.color = `hsl(${Math.random() * 360} 50% 50%)`;
		this.force.set(fx, fy);
	}

	update(deltaTime: number) {
		const delta = this.force.clone().mul(deltaTime / 100);
		this.position.add(delta);
		this.force.y += 10 * deltaTime / 100;
	}

	render(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.fillStyle = this.color;
		ctx.fillRect(this.position.x, this.position.y, 20, 20);
		ctx.restore();
	}
}

class ParticleRenderer {
	private _particles: Particle[] = [];

	update(deltaTime: number) {
		this._particles.forEach(particle => {
			particle.update(deltaTime);
		});
		this._particles = this._particles.filter(particle => particle.position.y < canvasHeight + 20);
	}

	render(ctx:CanvasRenderingContext2D) {
		this._particles.forEach(particle => particle.render(ctx));
	}

	shot(x: number, y: number) {
		for(let i = 0; i < 200; i++) {
			this._particles.push(new Particle(x, y));
		}
	}
}

class Marble {
	type: 'marble' = 'marble';
	name: string = '';
	size: number = 0.5;
	color: string = 'red';
	hue: number = 0;
	impact: number = 0;

	get position(){
		return this.body.getPosition();
	}

	get x() {
		return this.position.x;
	}
	set x(v: number) {
		this.position.x = v;
	}

	get y() {
		return this.position.y;
	}
	set y(v: number) {
		this.position.y = v;
	}

	body: planck.Body;

	constructor(world: planck.World, order: number, max: number, name?: string) {
		this.name = name || `M${order}`;
		this.body = world.createBody({
			type: 'dynamic',
			allowSleep: false,
			awake: false,
			linearDamping: 0,
			angularDamping: 0.01,
		});

		this.hue = 360 / max * order;
		this.color = `hsl(${this.hue} 100% 70%)`;

		const circle = planck.Circle(new Vec2(0, 0), this.size / 2);
		this.body.createFixture({ shape: circle, density: Math.random() + 1, restitution: 0.2 });
		this.body.setPosition(new Vec2(10 + ((order % 10) * 0.6) + (Math.floor(order/10)*0.05), 0 + (Math.floor(order / 10) * 1.1)));
		this.body.setUserData(this);
	}

	update(deltaTime: number) {
		if (this.impact) {
			this.impact = Math.max(0, this.impact - deltaTime);
		}
	}
}

function rad(degree: number) {
	return Math.PI * degree / 180;
}


function createMover(world: planck.World, pos: planck.Vec2, power: number) {
	const mover = world.createKinematicBody({ position: pos });
	mover.createFixture({
		shape: new planck.Box(2, 0.1),
		restitution: 0.7,
	});
	mover.setAngularVelocity(power);
	return mover;
}

function createBox(world: planck.World, pos: planck.Vec2, rotation: number, width: number = 0.5, height: number = 0.25) {
	const boxBody = world.createBody({
		type: 'static',
		position: pos,
	});

	boxBody.createFixture({
		shape: new planck.Box(width, height),
	});

	boxBody.setAngle(rotation);
	return boxBody;
}

class Roullete extends EventTarget {
	private _update: () => void;
	private _world!: planck.World;

	private _marbles: Marble[] = [];

	private _lastTime: number = 0;
	private _elapsed: number = 0;

	private _updateInterval = 10;
	private _timeScale = 1;

	private _canvas!: HTMLCanvasElement;
	private _ctx!: CanvasRenderingContext2D;

	private _goalY = -111;

	private _winners: Marble[] = [];

	private _zoom = initialZoom;

	private _camera: planck.Vec2 = new Vec2();
	private _cameraTarget: planck.Vec2 = new Vec2();

	private _objects: planck.Body[] = [];

	private _isStarted = false;
	private _particles = new ParticleRenderer();

	constructor() {
		super();
		this._update = this._updateHandler.bind(this);

		this._createElements();

		this._init();
		this._update();
	}

	private _createElements() {
		this._canvas = document.createElement('canvas');
		this._canvas.width = canvasWidth;
		this._canvas.height = canvasHeight;
		this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D;
		document.body.appendChild(this._canvas);
	}

	private _updateHandler() {
		if (!this._lastTime) this._lastTime = Date.now();
		const currentTime = Date.now();

		this._elapsed += currentTime - this._lastTime;
		this._lastTime = currentTime;

		while(this._elapsed >= this._updateInterval) {
			if (this._isStarted) {
				this._world.step((this._updateInterval * this._timeScale) / 1000);
				this._updateMarbles(this._updateInterval);
			}
			this._particles.update(this._updateInterval);
			this._elapsed -= this._updateInterval;
		}

		if (this._marbles.length === 0) {
			this._isStarted = false;
		}
		if (this._marbles.length > 1) {
			this._marbles.sort((a, b) => a.y - b.y);
		}
		this._render();
		window.requestAnimationFrame(this._update);
	}

	private _updateMarbles(deltaTime: number) {
		for (let contact = this._world.getContactList(); contact; contact = contact.getNext()) {
			if (!contact.isTouching()) continue;
			const manifold = contact.getManifold();
			const normalLength = manifold.localNormal.length();
			let fixtures = [contact.getFixtureA(), contact.getFixtureB()];
			fixtures.forEach(fixture => {
				const userData = fixture.getBody().getUserData();
				if (userData && userData instanceof Marble) {
					userData.impact += normalLength * 200;
					if (userData.impact > 500) userData.impact = 500;
				}
			});
		}

		for(let i = 0; i < this._marbles.length; i++) {
			const marble = this._marbles[i];
			marble.update(deltaTime);
			if (marble.y < this._goalY) {
				this._winners.push(marble);
				if (this._winners.length === 1) {
					this.dispatchEvent(new CustomEvent('goal', { detail: {winner: marble.name} }));
					this._particles.shot( this._canvas.width, this._canvas.height );
				}
				setTimeout(() => { this._world.destroyBody(marble.body) }, 500);
			}
		}

		const topY = this._marbles[0] ? this._marbles[0].y : 0;
		const goalDist = Math.abs(-106.75 - topY);
		if (this._winners.length === 0 && goalDist < 5) {
			if (this._marbles[1] && this._marbles[1].y < -104) {
				this._timeScale = Math.max(0.2, (goalDist / 5));
			} else {
				this._timeScale = 1;
			}
			this._zoom = initialZoom + ((1 - (goalDist / 5)) * 50);
		} else {
			this._timeScale = 1;
			this._zoom = initialZoom;
		}

		this._marbles = this._marbles.filter(marble => marble.y >= this._goalY);
	}

	private _render() {
		const cameraY = -(this._marbles[0] ? -this._marbles[0].y : 0);
		const cameraX = -(this._marbles[0] ? this._marbles[0].x : 0);


		this._cameraTarget.x = cameraX;
		this._cameraTarget.y = cameraY;

		const xDist = (this._cameraTarget.x - this._camera.x);
		const yDist = (this._cameraTarget.y - this._camera.y);
		const xFactor = (xDist / 5);
		const yFactor = (yDist / 5);

		if (Math.abs(xDist * this._zoom) > 3) {
			this._camera.x += xFactor;
		} else {
			this._camera.x = this._cameraTarget.x;
		}

		if (Math.abs(yDist * this._zoom) > 10) {
			this._camera.y += yFactor;
		} else {
			this._camera.y = this._cameraTarget.y;
		}

		this._ctx.fillStyle = 'black';
		this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
		this._ctx.save();
		this._ctx.textAlign = 'left';
		this._ctx.textBaseline = 'top';
		this._ctx.font = '0.4pt sans-serif';
		this._ctx.translate(this._camera.x * this._zoom + (this._canvas.width / 2), this._camera.y * this._zoom + (this._canvas.height / 2));
		this._ctx.scale(this._zoom, -this._zoom);
		this._renderWalls();
		this._renderObjects();
		this._renderMarbles();
		this._ctx.restore();

		this._ctx.save();
		this._ctx.fillStyle = `#333`;
		this._ctx.scale(4, -4);
		this._ctx.fillRect(0, 0, 26, -112);
		this._renderWalls(true);
		this._renderObjects(true);
		this._renderMarbles(false);
		this._ctx.restore();

		this._renderRanking();

		this._renderWinner();

		this._particles.render(this._ctx);
	}

	private _renderWalls(isMinimap: boolean = false) {
		this._ctx.save();
		this._ctx.strokeStyle = isMinimap ? 'black' : 'white';
		this._ctx.lineWidth = isMinimap ? 0.5 : 5 / this._zoom;
		this._ctx.beginPath();
		wallDefs.forEach((wallDef) => {
			this._ctx.moveTo(wallDef[0][0], wallDef[0][1]);
			for(let i = 1; i < wallDef.length; i++) {
				this._ctx.lineTo(wallDef[i][0], wallDef[i][1]);
			}
		});
		if (!isMinimap) {
			this._ctx.shadowColor = 'cyan';
			this._ctx.shadowBlur = 15;
		}
		this._ctx.stroke();
		this._ctx.closePath();
		this._ctx.restore();
	}

	private _renderObjects(isMinimap: boolean = false) {
		this._ctx.save();
		this._ctx.fillStyle = 'black';
		this._ctx.strokeStyle = '#94d5ed';
		this._ctx.lineWidth = 3 / this._zoom;
		this._objects.forEach(obj => {
			this._ctx.save();
			const pos = obj.getPosition();
			const ang = obj.getAngle();
			this._ctx.translate(pos.x, pos.y);
			this._ctx.rotate(ang);
			for(let fixture = obj.getFixtureList(); fixture; fixture = fixture.getNext()) {
				const shape = fixture.getShape() as planck.Polygon;
				const vertices = shape.m_vertices;
				this._ctx.beginPath();
				this._ctx.moveTo(vertices[0].x, vertices[0].y);
				for(let i = 0; i < vertices.length; i++) {
					const vert = vertices[(i + 1) % vertices.length];
					this._ctx.lineTo(vert.x, vert.y);
				}
				this._ctx.fill();

				if (!isMinimap) {
					this._ctx.save();
					this._ctx.shadowBlur = 15;
					this._ctx.shadowColor = 'cyan';
					this._ctx.stroke();
					this._ctx.restore();
				}

				this._ctx.closePath();
			}
			this._ctx.restore();
		});
		this._ctx.restore();
	}

	private _renderMarbles(showName: boolean = true) {
		this._marbles.forEach(marble => {
			this._ctx.save();
			this._ctx.strokeStyle = 'black';
			this._ctx.lineWidth = 2 / this._zoom;
			if (showName) {
				this._ctx.shadowColor = marble.color;
				this._ctx.shadowBlur = this._zoom / 2;
			}
			if (showName) {
				this._ctx.fillStyle = `hsl(${marble.hue} 100% ${70 + (25 * Math.min(1, marble.impact / 500))}%`;
			} else {
				this._ctx.fillStyle = marble.color;
			}
			this._ctx.beginPath();
			this._ctx.arc(marble.x, marble.y, showName ? marble.size / 2 : marble.size, 0, Math.PI * 2);
			this._ctx.fill();

			if (showName) {
				this._ctx.save();
				this._ctx.fillStyle = marble.color;
				this._ctx.shadowBlur = 0;
				this._ctx.scale(1, -1);
				this._ctx.strokeText(marble.name, marble.x, -marble.y + 0.25);
				this._ctx.fillText(marble.name, marble.x, -marble.y + 0.25);
				this._ctx.restore();
			}

			this._ctx.restore();
		});
	}

	private _init() {
		this._world = new planck.World({
			gravity: new Vec2(0, -10)
		});

		this._loadMap();
	}

	private _renderRanking() {
		this._ctx.save();
		this._ctx.font = 'bold 11pt sans-serif';
		this._ctx.textAlign = 'right';
		this._winners.forEach((marble, rank) => {
			this._ctx.fillStyle = marble.color;
			this._ctx.fillText(`\u2714 ${marble.name} #${rank + 1}`, this._canvas.width - 10, 20 + rank * 20);
		});
		this._ctx.font = '10pt sans-serif';
		this._marbles.forEach((marble, rank) => {
			this._ctx.fillStyle = marble.color;
			this._ctx.fillText(`${marble.name} #${rank + 1 + this._winners.length}`, this._canvas.width - 10, 20 + (rank + this._winners.length) * 20);
		});
		this._ctx.restore();
	}

	private _renderWinner() {
		if (this._winners.length === 0) return;
		this._ctx.save();
		this._ctx.fillStyle = 'white';
		this._ctx.font = 'bold 48px sans-serif';
		this._ctx.textAlign = 'right';
		this._ctx.fillText('Winner', canvasWidth - 10, canvasHeight - 120);
		this._ctx.font = 'bold 72px sans-serif';
		this._ctx.fillStyle = (Math.floor(this._lastTime / 500) % 2) === 0 ? this._winners[0].color : 'white';
		this._ctx.fillText(this._winners[0].name, canvasWidth - 10, canvasHeight - 55);
		this._ctx.restore();
	}

	private _loadMap() {
		wallDefs.forEach((wallDef) => {
			const wall = this._world.createBody({ type: 'static'});
			wall.setPosition(new Vec2(0, 0));
			wall.createFixture({
				shape: planck.Chain(wallDef.map(pos => new Vec2(...pos)), false),
			});
		});

		for(let i = 0; i < 5; i++) {
			this._objects.push(createMover(this._world, new Vec2(8 + (i * 4), -170 / 2), 3.5 * (i%2===1 ? 1 : -1)));
		}
		this._objects.push(createMover(this._world, new Vec2(13.9, -106.75), 1.2));
		[
			[270, 645, 45],
		].forEach(boxDef => {
			this._objects.push(createBox(this._world, new Vec2(boxDef[0] / 20, -boxDef[1] / 20), boxDef[2]));
		});

		for (let i = 0; i < 8; i++) {
			this._objects.push(createBox(this._world, new Vec2((188 + (i*38)) / 20, -1332 / 20), 45 * (i%2 === 0 ? -1 : 1)));
			this._objects.push(createBox(this._world, new Vec2((188 + (i*38)) / 20, -1382 / 20), 45 * (i%2 === 0 ? 1 : -1)));
		}

		for(let i = 0; i < 5; i++) {
			this._objects.push(createBox(this._world, new Vec2(9.5 + (i * (16.25 / 5)), -98), 45, 0.25, 0.25));
		}
		for(let i = 0; i < 4; i++) {
			this._objects.push(createBox(this._world, new Vec2(11.0 + (i * (16.25 / 5)), -95), 45, 0.25, 0.25));
		}
	}

	public clearMarbles() {
		this._marbles.forEach(marble => {
			this._world.destroyBody(marble.body);
		});
		this._winners = [];
		this._marbles = [];
	}

	public start() {
		this._isStarted = true;
	}

	public setMarbles(names: string[]) {
		this.clearMarbles();
		const arr = names.slice();
		arr.sort(() => Math.random() - 0.5);
		arr.forEach((name, i) => {
			this._marbles.push(new Marble(this._world, i, arr.length, name));
		});
	}

	public reset() {
		this.clearMarbles();
		this._isStarted = false;
	}

}

const roullete = new Roullete();
(window as any).roullete = roullete;
