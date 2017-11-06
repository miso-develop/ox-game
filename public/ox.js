"use strict";

const l = v => console.log(v)

//firebase
let db = {}
document.addEventListener("DOMContentLoaded", () => db = firebase.database());

//Vue
const vm = new Vue({
	el: "#main",
	data: {
		roomId: "",
		id: "",
		ref: {},
		sync: {
			host: "",
			guest: "",
			
			turn: -1,
			judgment: -1,
			board: [],
			
			timestamp: 0,
		},
	},
	created: function() {this.initGame()},
	computed: {
		view: function() {return !this.id ? "lobby" : "game"},
		mark: function() {return this.id == this.sync.host ? 0 : 1},
	},
	methods: {
		//初期化
		initGame: function() {
			this.sync.board =  [
				[3, 3, 3, 3, 3],
				[3, 2, 2, 2, 3],
				[3, 2, 2, 2, 3],
				[3, 2, 2, 2, 3],
				[3, 3, 3, 3, 3]
			]
			this.sync.turn = Math.round(Math.random())
			this.sync.judgment = -1
		},
		
		//部屋作成
		createRoom: async function() {
			//Guestが来るまで操作出来ないようにturnを-1に
			this.sync.turn = -1
			
			//id生成
			this.id = this.createId()
			this.sync.host = this.id
			this.roomId = this.id.substr(4)
			
			//DB参照
			this.ref = db.ref("/ox/" + this.roomId)
			//対象room情報取得
			const snapshot = await this.ref.once("value")
			//既に部屋があったらリトライ
			if (snapshot.val()) {this.createRoom(); return}
			
			//timestamp
			this.sync.timestamp = moment(new Date).format("YYYY/MM/DD HH:mm:ss")
			//DB更新
			this.ref.set(this.sync)
			//DBイベント定義
			this.setPush()
			
		},
		
		//部屋に入る
		goRoom: async function() {
			//空入力チェック
			if (this.roomId == "") {alert("no room!"); return}
			
			//DB参照
			this.ref = db.ref("/ox/" + this.roomId)
			//対象room情報取得
			const snapshot = await this.ref.once("value")
			//部屋あるかチェック
			if (!snapshot.val()) {alert("no room!"); return}
			
			//DB情報取得
			this.sync = snapshot.val()
			//既にguestがいるかチェック
			if (this.sync.guest != "") {alert("this room is no vacancy!"); return}
			
			//guest id生成、hostと被ったら再生成
			let count = 0
			do {
				this.id = this.createId()
			} while (this.id == this.sync.host && count < 5)
			if (count == 5) {alert("error!"); return}
			
			//guest更新
			this.sync.guest = this.id
			//turn値をランダム取得
			this.sync.turn = Math.round(Math.random())
			
			//DB更新
			this.ref.set(this.sync)
			//DBイベント定義
			this.setPush()
			
		},
		
		//DBイベント定義
		setPush: function() {
			this.ref.on("value", function(snapshot) {
				//DBデータをローカルへ反映
				vm.sync = snapshot.val()
				//終了判定
				vm.gemaSet()
			})
		},
		
		//
		put: function(x, y) {
			//置けるかチェック
			if (!this.checkPut(x, y)) return
			
			//マーク付け
			this.sync.board[x][y] = this.sync.turn
			//勝敗判定
			this.sync.judgment = this.judge(x, y)
			//ターン交代
			this.sync.turn = 1 - this.sync.turn
			
			//DB更新
			this.ref.set(this.sync)
			
		},
		
		//置けるかチェック
		checkPut: function(x, y) {
			//自分の番じゃなければ処理せず
			if (this.sync.turn != this.mark) return false
			//空白以外を押しても処理せず
			if (this.sync.board[x][y] != 2) return false
			return true
		},
		
		//勝敗判定
		judge: function(x, y) {
			//勝敗判定
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					if (dx == 0 && dy == 0) continue
					let count = 0
					let k = 1
					while (this.sync.board[x + k * dx][y + k * dy] <= 1) {
						if (this.sync.board[x + k * dx][y + k * dy] == this.sync.turn) {
							k = 1
							while (this.sync.board[x + k * dx][y + k * dy] == this.sync.turn) {
								count++
								k++
							}
							k = 1
							while (this.sync.board[x + -k * dx][y + -k * dy] == this.sync.turn) {
								count++
								k++
							}
							break
						}
						k++
					}
					if (count == 2) return this.mark
				}
			}
			//押す場所がなくなった判定
			if (this.sync.board.join("").indexOf(2) == -1) return 2
			//上記以外
			return -1
		},
		
		//終了判定
		gemaSet: function() {
			//既定値なら何もせず
			if  (this.sync.judgment == -1) return
			
			//盤面操作無効化
			this.sync.turn = -1
			
			//chrome用にwait
			setTimeout(function(){
				//勝敗出力
				switch(vm.sync.judgment) {
					case vm.mark: alert("you win!"); break
					case 1 - vm.mark: alert("you lose!"); break
					case 2: alert("draw!")
				}
				
				//host側で初期化
				if (vm.mark == 0) {
					//初期化
					vm.initGame()
					//DBも初期化
					vm.ref.set(vm.sync)
				}
			}, 10)
		},
		
		//id生成
		createId: () => String(Math.random()).substr(2,8),
		
		//配列、数値をOXに変換
		parseOX: val => {
			if (val == 0) return "O"
			if (val == 1) return "X"
		},
		
	},
})
