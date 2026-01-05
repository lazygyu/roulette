import { MembersGroup } from './membersGroup';

export class TeamDicider {
    private _groups: MembersGroup[] = [];

    public addGroup() {
        this._groups.push(new MembersGroup());
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

    public getGroupIndex(member: string): number {
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
}