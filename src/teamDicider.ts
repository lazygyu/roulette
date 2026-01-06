import { Marble } from './marble';
import { MembersGroup } from './membersGroup';

enum LaneType {
    FromTop = 0,
    FixedLane,
    Randoms     // TODO
}

export class TeamDicider {
    private _groups: MembersGroup[] = [];

    private _laneType: LaneType = LaneType.FromTop;
    // designated lane groups if type is FixedLane. -1 === any group. it can be longer than 5 if each side assigned to different group
    private _laneGroups: number[] = [];

    private _teamResult: string[] = [];

    public addGroup() {
        const newMembersGroup = new MembersGroup();
        newMembersGroup.setIndex(this._groups.length);
        this._groups.push(newMembersGroup);
    }

    public setGroupName(index: number, name: string) {
        if (this._groups.length <= index) {
            return;
        }

        this._groups[index].setName(name);
    }

    public setGroupMembers(index: number, members: string) {
        if (this._groups.length <= index) {
            return;
        }

        this._groups[index].setMembers(members);
    }

    private getGroupIndex(member: string): number {
        for (let index = 0; index < this._groups.length; index++) {
            if (this._groups[index].isMember(member)) {
                return index;
            }
        }
        return -1;
    }

    public removeGroup() {
        this._groups.pop();
    }

    public getGroupStr(): string {
        const groupstrs = [];
        for (const group of this._groups) {
            groupstrs.push(group.getGroupStr());
        }
        return groupstrs.join('/');
    }

    public updateTeams(winners: Marble[]) {
        switch (this._laneType) {
            case LaneType.FromTop:
                this.updateTeamsFromTop(winners);
                break;
            case LaneType.FixedLane:
                this.updateTeamsWithFixedLane(winners);
                break;
        }
    }

    private updateTeamsFromTop(winners: Marble[]) {
        const teamResult: string[] = new Array(10).fill('');
        const remainders: string[] = [];

        let teamMemberIndex = 0;
        for (const winner of winners) {
            if (teamMemberIndex < 5) {
                teamResult[teamMemberIndex++] = winner.name;
            } else {
                let bFindTeam: boolean = false;
                for (let index = 5; index < 10; index++)
                {
                    if (teamResult[index].length !== 0) {
                        continue;
                    }

                    if (this.getGroupIndex(teamResult[index - 5]) === this.getGroupIndex(winner.name)) {
                        teamResult[index] = winner.name;
                        bFindTeam = true;
                        break;
                    }
                }

                if (!bFindTeam) {
                    remainders.push(winner.name);
                }
            }
        }

        let remainderIndex = 0;
        for (const index in teamResult) {
            if (remainderIndex >= remainders.length) {
                break;
            }

            if (teamResult[index].length === 0) {
                teamResult[index] = remainders[remainderIndex++];
            }
        }

        this._teamResult = teamResult.concat(remainders.slice(remainderIndex));
    }

    private isAvailableInFixedLane(lane: number, member: string): boolean {
        if (this._laneType !== LaneType.FixedLane || lane >= 10) {
            return false;
        }

        if (this._laneGroups.length <= lane - 5) {
            return true;
        }
        
        if (this._laneGroups.length <= lane) {
            lane -= 5;
        }

        return this._laneGroups[lane] === -1 || this._laneGroups[lane] === this.getGroupIndex(member);
    }

    private updateTeamsWithFixedLane(winners: Marble[]) {
        const teamResult: string[] = new Array(10).fill('');
        const remainders: string[] = [];

        for (const winner of winners) {
            let bFindTeam: boolean = false;
            for (let index = 0; index < 10; index++) {
                if (teamResult[index].length === 0 && this.isAvailableInFixedLane(index, winner.name)) {
                    teamResult[index] = winner.name;
                    bFindTeam = true;
                    break;
                }
            }

            if (!bFindTeam) {
                remainders.push(winner.name);
            }
        }

        let remainderIndex = 0;
        for (const index in teamResult) {
            if (remainderIndex >= remainders.length) {
                break;
            }

            if (teamResult[index].length === 0) {
                teamResult[index] = remainders[remainderIndex++];
            }
        }

        this._teamResult = teamResult.concat(remainders.slice(remainderIndex));
    }
}