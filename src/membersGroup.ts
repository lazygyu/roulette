export class MembersGroup {
    private _index: number = 0;
    
    private _name: string = '';

    private _members: string[] = [];

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
}