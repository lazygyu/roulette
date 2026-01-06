import { Marble } from './marble';
import { MembersGroup } from './membersGroup';
import { RenderParameters } from './rouletteRenderer';
import { Rect } from './types/rect.type';
import { UIObject } from './UIObject';

enum LaneType {
    FromTop = 0,
    FixedLane,
    Random     // TODO
}

export class TeamDicider implements UIObject {
    private _groups: MembersGroup[] = [];

    private _laneType: LaneType = LaneType.FromTop;
    // designated lane groups if type is FixedLane. -1 === any group. it can be longer than 5 if each side assigned to different group
    private _laneGroups: number[] = [];

    private _winners: string = '';
    private _teamResult: string[] = new Array(10).fill('');
    private _remainders: string[] = [];

    // for render
    private _currentY = 0;
    private _targetY = 0;
    private fontHeight = 16;
    private _userMoved = 0;
    private _currentWinner = -1;
    private maxY = 0;

    update(deltaTime: number): void {
        
    }

    render(
        ctx: CanvasRenderingContext2D, 
        { winners, theme }: RenderParameters, 
        width: number, 
        height: number
    ): void {
        this.updateTeams(winners);

        if (this._winners.length === 0) {
            return;
        }

        const startX = width - 5;
        const startY = Math.max(-this.fontHeight, this._currentY - height / 2);
        this.maxY = this.fontHeight * 7;
        this._currentWinner = winners.length;

        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = '10pt sans-serif';
        ctx.fillStyle = '#666';

        ctx.beginPath();
        ctx.rect(width - 150, this.fontHeight + 2, width, this.maxY);
        ctx.clip();

        ctx.translate(0, -startY);
        ctx.font = 'bold 11pt sans-serif';
        if (theme.rankStroke) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = theme.rankStroke;
        }

        const lanes = ['top', 'jg', 'mid', 'adc', 'sup'];
        for (let index = 0; index < 5; index++) {
            let team1 = this._teamResult[index];
            let team2 = this._teamResult[index + 5];
            if (team1.length === 0 && team2.length === 0) {
                team1 = '--';
                team2 = '--';
            } else if (team1.length === 0) {
                team1 = '-'.repeat(team2.length);
            } else if (team2.length === 0) {
                team2 = '-'.repeat(team1.length);
            }

            const teamText = `${team1}\t${lanes[index]}\t${team2}`;
            ctx.strokeText(
                teamText, 
                startX, 
                20 + index * this.fontHeight
            );
            ctx.fillText(
                teamText,
                startX,
                20 + index * this.fontHeight
            );
        }
        ctx.restore();

    }

    getBoundingBox(): Rect | null {
        return null;
    }

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

    public setLaneType(laneType: string) {
        if (laneType === 'fixedLane') {
            this._laneType = LaneType.FixedLane;
        } else if (laneType === 'random') {
            this._laneType = LaneType.Random;
        } else {
            this._laneType = LaneType.FromTop;
        }
    }

    private getGroupIndex(member: string): number {
        for (let index = 0; index < this._groups.length; index++) {
            if (this._groups[index].isMember(member)) {
                return index;
            }
        }
        console.log(`unknown member: ${member}`);
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
        if (winners.length === 0) {
            this.resetTeamResult();
            return;
        }

        let winnerStr = winners.map((winner: Marble) => winner.name).join(',');

        if (winnerStr === this._winners) {
            return;
        }
        const oldWinners = this._winners.split(',');
        const addedWinners = winners.filter((winner: Marble) => !oldWinners.includes(winner.name));
        this._winners = winnerStr;

        switch (this._laneType) {
            case LaneType.FromTop:
                this.updateTeamsFromTop(addedWinners);
                break;
            case LaneType.FixedLane:
                this.updateTeamsWithFixedLane(addedWinners);
                break;
        }

        if (this._teamResult.length > 0) {
            console.log('team result');
            console.log(this._teamResult.slice(0, 5));
            console.log(this._teamResult.slice(5, 10));
            console.log(this._teamResult.slice(10));
        }
    }

    private resetTeamResult() {
        if (this._winners.length === 0) {
            return;
        }

        this._winners = '';
        this._teamResult = new Array(10).fill('');
        this._remainders = [];
    }

    private updateTeamsFromTop(newMembers: Marble[]) {
        const membersInTeam1GroupMap = new Map<number, number[]>();
        for (let index = 0; index < 5; index++) {
            const memberName = this._teamResult[index];
            if (memberName.length === 0) {
                continue;
            }

            const groupIndex = this.getGroupIndex(memberName);
            const membersInTeam1 = membersInTeam1GroupMap.get(groupIndex);
            if (membersInTeam1) {
                membersInTeam1.push(index);
            } else {
                membersInTeam1GroupMap.set(groupIndex, [index]);
            }
        }

        for (const newMember of newMembers) {
            const groupIndex: number = this.getGroupIndex(newMember.name);
            let membersInTeam1 = membersInTeam1GroupMap.get(groupIndex);
            let bIsRemainder = true;
            if (membersInTeam1 && membersInTeam1.length >= this._groups[groupIndex].getLength() / 2) {
                for (const index of membersInTeam1) {
                    if (this._teamResult[index + 5].length === 0) {
                        this._teamResult[index + 5] = newMember.name;
                        bIsRemainder = false;
                        break;
                    }
                }
            } else {
                for (let index = 0; index < 5; index++) {
                    if (this._teamResult[index].length === 0) {
                        this._teamResult[index] = newMember.name;
                        bIsRemainder = false;
                        if (membersInTeam1) {
                            membersInTeam1.push(index);
                        } else {
                            membersInTeam1GroupMap.set(groupIndex, [index]);
                        }
                        break;
                    }
                }
            }

            if (bIsRemainder) {
                this._remainders.push(newMember.name);
            }
        }
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

    private updateTeamsWithFixedLane(newMembers: Marble[]) {
        for (const newMember of newMembers) {
            let bIsRemainder: boolean = true;
            for (let index = 0; index < 10; index++) {
                if (this._teamResult[index].length === 0 && this.isAvailableInFixedLane(index, newMember.name)) {
                    this._teamResult[index] = newMember.name;
                    bIsRemainder = false;
                    break;
                }
            }

            if (bIsRemainder) {
                this._remainders.push(newMember.name);
            }
        }
    }
}