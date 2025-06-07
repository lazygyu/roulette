import { StageDef, stages } from 'common';
import { IPhysics } from '../IPhysics';

export class MapManager {
  private _stage: StageDef | null = null;

  constructor(private physics: IPhysics) {
    this._stage = stages[0];
    this.loadMap();
  }

  get stage(): StageDef | null {
    return this._stage;
  }

  get currentMapIndex(): number {
    if (!this._stage) return -1;
    return stages.findIndex((stage) => stage === this._stage);
  }

  public loadMap() {
    if (!this._stage) {
      throw new Error('No map has been selected');
    }
    this.physics.clearEntities();
    this.physics.createStage(this._stage);
  }

  public setMap(index: number) {
    if (index < 0 || index > stages.length - 1) {
      throw new Error('Incorrect map number');
    }
    this._stage = stages[index];
    this.loadMap();
  }

  public getMaps() {
    return stages.map((stage, index) => {
      return {
        index,
        title: stage.title,
      };
    });
  }
}
