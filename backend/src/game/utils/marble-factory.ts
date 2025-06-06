import { Marble } from '../marble';
import { IPhysics } from '../IPhysics';
import { parseName } from './utils';

interface MemberInfo {
  name: string;
  weight: number;
  count: number;
}

export class MarbleFactory {
  static createMarbles(physics: IPhysics, names: string[]): { marbles: Marble[], totalMarbleCount: number } {
    const members = this.parseMembers(names);
    const totalMarbleCount = members.reduce((sum, member) => sum + member.count, 0);
    const normalizedMembers = this.normalizeWeights(members);

    const marbles: Marble[] = [];
    const orders = Array(totalMarbleCount)
      .fill(0)
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5);

    normalizedMembers.forEach((member) => {
      for (let j = 0; j < member.count; j++) {
        const order = orders.pop() || 0;
        marbles.push(new Marble(physics, order, totalMarbleCount, member.name, member.weight, false));
      }
    });

    return { marbles, totalMarbleCount };
  }

  private static parseMembers(names: string[]): MemberInfo[] {
    return names
      .map((nameString) => {
        const result = parseName(nameString);
        if (!result) return null;
        return { name: result.name, weight: result.weight, count: result.count };
      })
      .filter((member): member is MemberInfo => !!member);
  }

  private static normalizeWeights(members: MemberInfo[]): MemberInfo[] {
    if (members.length === 0) return [];

    let maxWeight = -Infinity;
    let minWeight = Infinity;

    members.forEach((member) => {
      if (member.weight > maxWeight) maxWeight = member.weight;
      if (member.weight < minWeight) minWeight = member.weight;
    });

    const gap = maxWeight - minWeight;

    return members.map((member) => ({
      ...member,
      weight: 0.1 + (gap ? (member.weight - minWeight) / gap : 0),
    }));
  }
}
