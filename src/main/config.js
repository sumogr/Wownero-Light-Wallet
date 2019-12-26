const fs = require('fs');


export class Config {
    constructor(sumodir) {
        this._path_cfg = `${sumodir}/sumolight.json`;
        this.create();
        this.data = this.load();
    }

    load(){
        if (!fs.existsSync(this._path_cfg)) {
            console.log('no file yo');
            return {};
        }

        let contents = fs.readFileSync(this._path_cfg, 'utf8');
        return JSON.parse(contents);
    }

    create(){
        if (fs.existsSync(this._path_cfg)) {
            return;
        }

        let data = JSON.stringify({
            "node": "68.183.134.212:19734",
            "nodes": [
                {"address": "134.209.109.190:19734", "location": "Singapore", "region": "Singapore"}
            ],
            "wallets": []
        });

        fs.writeFileSync(this._path_cfg, JSON.stringify(data));
        console.log(`${this._path_cfg} written`);
    }

    save(){
        fs.writeFileSync(this._path_cfg, JSON.stringify(this.data, null, 4));
        console.log(`${this._path_cfg} written`);
    }

    selectNode(node){
        if (typeof this.data === 'string' || this.data instanceof String){
            this.data = JSON.parse(this.data);
        }

        node = node.trim();
        if(node === ''){
            return;
        }

        console.log('NEW NODE: ' + node);
        this.data.node = node;
        this.save();

        return true;
    }
}
