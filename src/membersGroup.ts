export class MembersGroup {
    private _index: number = 0;
    
    private _name: string = '';

    private _members: string[] = [];

    public setIndex(index: number) {
        this._index = index;
    }

    public setName(name: string) {
        this._name = name;
    }

    public setMembers(members: string) {
        const value = members.trim();
        if (value) {
            this._members = value.split(/[,\r\n]/g).map(v => v.trim()).filter(v => !!v);
        } else {
            this._members = [];
        }
    }

    public isMember(member: string): boolean {
        return this._members.includes(member.trim());
    }

    public getGroupStr(): string {
        if (this._name.length > 0) {
            return this._name + ',' + this._members.join(',');
        }
        return (this._index + 1).toString() + ',' + this._members.join(',');
    }
}