////////////////////////////////////////////////////////////////////////////////
//
// 2017/4/18
//
// 主要在計算
// e.touches[0].pageX
// e.touches[0].pageY
//
////////////////////////////////////////////////////////////////////////////////
//
// 有 touchstart 就一定有 touchend => 即使 resize or oritation
// touchend => touches(touchList).length = 0
//
//
////////////////////////////////////////////////////////////////////////////////
(function($, global) {
    var _forTest = false;

    var defaultConfig = {
        x: null, // 是否要設置 x 域值
        y: null, // 是否要設置 y 域值
        interval: null, // 間隔多久偵測一次
        start: null, // touchstart 時要做什麼
        move: null, // touchmove 時要做什麼
        end: null, // touchend 時要做什麼
        preventDefault: false
    };
    /* ====================================================================== */
    /**
     * 對外命令
     *
     */
    $.fn.bindTouchwipeEvent = function(option) {

        var config = $.extend({}, defaultConfig);
        $.extend(config, option);
        /* ------------------------ */
        this.each(function(i, dom) {

            $.bindTouchwipeEvent(dom, config);
        });
        /* ------------------------ */
        return this;
    };
    /* ====================================================================== */
    /**
     * 對一個 dom 綁定 touchEvent
     */
    $.bindTouchwipeEvent = function(elem, config) {
        var touchEvent;

        _console('bindTouchwipeEvent');

        if (typeof config.x === 'number' &&
            typeof config.y === 'number' && config.x && config.y) {
            // 若有設定閾值，用 type_1
            _console(' use TouchEvent_1');
            touchEvent = new TouchEvent_1(elem, config);
        } else {
            _console(' use TouchEvent_2');
            // 若沒設定閾值，用 type_2
            touchEvent = new TouchEvent_2(elem, config);
        }

        /* ---------------------------------- */

        if (_forTest || 'ontouchstart' in document.documentElement) {
            alert('support');
            /**
             * 綁定事件
             */
            elem.addEventListener('touchstart', e_start.bind(touchEvent));
            elem.addEventListener('touchmove', e_move.bind(touchEvent));
            elem.addEventListener('touchend', e_end.bind(touchEvent));
            /* ---------------------------------- */
            function e_start(e) {
                try {
                    (config.preventDefault) && e.preventDefault();
                    this.e_touchStart(e);
                } catch (error) {
                    _console('start error: ', error.toString());
                }
            }
            /* ---------------------------------- */
            function e_move(e) {
                try {
                    (config.preventDefault) && e.preventDefault();
                    this.e_touchMove(e);
                } catch (error) {
                    _console('move error: ', error.toString());
                }
            }
            /* ---------------------------------- */
            function e_end(e) {
                try {
                    (config.preventDefault) && e.preventDefault();
                    this.e_touchEnd(e);
                } catch (error) {
                    _console('end error: ', error.toString());
                }
            }
        } else {
            alert('no support');
            // throw new Error('no support touchEvent');
        }
    };
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    /**
     * 只做座標計算
     *
     * @param {*} dom
     * @param {*} config
     */
    function Core(dom, config) {
        this.dom = dom;
        this.config = config;
        this.data = {
            startX: null,
            startY: null,
            x: null,
            y: null,
            dx: null,
            dy: null,
            totalDx: null,
            totalDy: null,
            direction: ''
        }
    }

    (function(fn) {
        this.start = function(e) {
            var data = this.data;

            if (e.touches.length == 1) {
                data.startX = data.x = e.touches[0].pageX;
                data.startY = data.y = e.touches[0].pageY;
            } else {
                throw new Error('no get touchEvent.data');
            }

            return this.data;
        };
        /* ================================================================== */
        this.move = function(data, x, y) {

            data.dx = x - data.x;
            data.dy = y - data.y;
            data.totalDx = (data.totalDx == null ? data.dx : (data.totalDx + data.dx));
            data.totalDy = (data.totalDy == null ? data.dy : (data.totalDy + data.dy));

            data.x = x;
            data.y = y;
        };
        /* ================================================================== */
        /*
          類別方法
        */
        fn.getDirection = function(dx, dy) {
            var result = '';

            if (Math.abs(dx) > Math.abs(dy)) {
                result = (dx < 0 ? 'left' : 'right');
            } else if (Math.abs(dx) < Math.abs(dy)) {
                result = (dy < 0 ? 'up' : 'down');
            }
            return result;
        }

    }).call(Core.prototype, Core);
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    /**
     * 針對移動距離有閾值的狀況
     *
     * @param {*} dom
     * @param {*} config
     */
    function TouchEvent_1(dom, config) {
        this.fn = TouchEvent_1;
        this.dom = dom;

        // user 設定值
        this.config = config;

        // 避免 start 後 end 沒結束
        // 要 start -> end 整個確定結束後，才進行下一步
        // 不然有時瀏覽器會出錯
        // start +1, end -1
        this.jobCount = 0;

        // 核心(專門計算座標用)
        this.core;

        // timeSample 用
        this.lastStep;

        // 座標值
        this.data;
        this.timeHandle;

        // 上鎖的開始時間
        this.lockStartTime;
    }
    /* ====================================================================== */
    (function() {
        this.e_touchStart = function(e) {
            // debugger;
            // e = e.detail;

            if (this.jobCount > 2) {
                // 避免過多事件堆跌
                return;
            }

            /* ---------------------------------- */
            this.lastStep = undefined;
            this.lockStartTime = undefined;

            ++this.jobCount;
            /* ---------------------------------- */
            this.core = new Core(this.dom, this.config);

            // 藉由 core 計算座標
            this.data = this.core.start(e);

            if (typeof this.config.start === 'function') {
                // 複製移動的資料
                var cloneData = $.extend({}, this.data);
                this.config.start.call(this.dom, e, cloneData);
            }
        };
        /* ================================================================== */
        /*
          比較麻煩處
        */
        this.e_touchMove = function(e) {
            /* ---------------------------------- */
            var self = this,
                config = this.config;

            var _x = e.touches[0].pageX;
            var _y = e.touches[0].pageY;


            if (!this.core) {
                // start -> end 執行完，就不繼續

                // _console('e_touchMove -> no core');
                return;
            }

            /* ---------------------------------- */
            if (typeof config.interval !== 'number' || !config.interval) {
                // 若不使用 debounce

                _console('e_touchMove ->no debounce');

                // 是否到了結束的條件
                if (this._ifEnd(_x, _y)) {
                    // 若達閾值，跳出
                    return;
                }

            } else {
                // 若有設置時間間隔偵 debounce
                // 避免事件過度激發

                var now;
                if (!this.lockStartTime) {
                    now = this.lockStartTime = (new Date()).getTime();
                } else {
                    now = (new Date()).getTime();
                }

                var def = now - this.lockStartTime;

                // console.log('lockStartTime: ', this.lockStartTime, ',def: ', def, ',interval: ', config.interval);
                if (def > config.interval) {
                    // 超過上鎖的時間
                    // 開鎖

                    _console('<<open lock>>');

                    this.lastStep = undefined;

                    if (this._ifEnd(_x, _y)) {
                        return;
                    }

                    // 再次上鎖
                    this.lockStartTime = (new Date()).getTime();
                } else {
                    // 上鎖中
                    // 為了最後一次執行，雖不執行但更新數據

                    _console('lock');

                    this.lastStep = {
                        x: _x,
                        y: _y
                    };
                }
            } //----
        };
        /* ================================================================== */
        this.e_touchEnd = function(e) {
            // debugger;
            // alert('e_touchEnd');
            --this.jobCount;

            // 做最後一次檢查
            this._endCheck(e);

            this.core = undefined;
            this.lastStep = undefined;

            _console('////////////////////////////////');

        };
    }).call(TouchEvent_1.prototype);
    /* ======================================================================== */
    (function() {

        /**
         * 測量工作
         * @throws {Error} 告知是否已達標準
         */
        this._ifEnd = function(_x, _y, e) {

            if (!this.core) {
                return true;
            }

            var config = this.config;
            var data = this.data;
            /* ---------------------------------- */
            // 藉由 core 計算座標
            this.core.move(data, _x, _y);

            /* ---------------------------------- */
            // 計算方向
            data.direction = Core.getDirection(data.dx, data.dy);

            _console('move direct: ', data.direction);

            /* ---------------------------------- */
            // 判斷是否到達閾值
            var judge_1 = Math.abs(data.totalDx) >= config.x;
            var judge_2 = Math.abs(data.totalDy) >= config.y;

            if (judge_1 || judge_2) {

                // 若達到閾值標準
                this._okUDone();

                return true;
            } else {
                // 若未達閾值

                if (typeof this.config.move === 'function') {
                    var cloneData = $.extend({}, this.data);
                    this.config.move.call(this.dom, e, cloneData);
                }
            }

            return false;
        };

        /* ================================================================== */
        /*
          若移動長度達到條件了
        */
        this._okUDone = function(e) {

            // 取得方向
            var data = this.data;

            data.direction = Core.getDirection(data.totalDx, data.totalDy);

            _console('finish >> okUDone: ', data.direction, ', x: ', data.totalDx, ', y: ', data.totalDy, ', direc: ', data.direction);

            this.core = undefined;
            this.lastStep = undefined;

            if (typeof this.config.end === 'function') {
                var cloneData = $.extend({}, this.data);

                this.config.end(e, cloneData);
            }

        };
        /* ================================================================== */
        /*
         touchend 呼叫
         再一次檢查
         */
        this._endCheck = function(e) {

            //  若移動尚未達閾值，this.core 還會在
            // 有 lastStep
            if (this.lastStep && this.core) {

                _console('have lastStep');

                // 再計算一次座標
                var _x = this.lastStep.x;
                var _y = this.lastStep.y;

                this.lastStep = undefined;

                if (this._ifEnd(_x, _y, e)) {
                    // 達到長度的標準
                    return;
                }
            } //---------
        };
    }).call(TouchEvent_1.prototype);
    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////

    /*
      針對連續移動
    */
    function TouchEvent_2(dom, config) {

        // 繼承 TouchEvent_1 大部分的屬性
        TouchEvent_1.call(this, dom, config);

        this.fn = TouchEvent_2;
    }
    /* ====================================================================== */

    (function() {
        this.e_touchStart = function(e) {
            if (this.jobCount > 2) {
                // start +1
                // end -1
                // 避免過多事件堆跌
                return;
            }


            /* ---------------------------------- */
            this.lockStartTime = undefined;

            ++this.jobCount;
            /* ---------------------------------- */
            this.core = new Core(this.dom, this.config);

            // 藉由 core 計算座標
            this.data = this.core.start(e);

            if (typeof this.config.start === 'function') {
                // 複製移動的資料
                var cloneData = $.extend({}, this.data);
                this.config.start.call(this.dom, e, cloneData);
            }
        };
        /* ================================================================== */
        this.e_touchMove = function(e) {



            var self = this,
                config = this.config;

            var _x = e.touches[0].pageX;
            var _y = e.touches[0].pageY;

            /* ---------------------------------- */

            if (typeof config.interval !== 'number' || !config.interval) {
                // 若不使用 debounce
                console.log('e_touchMove ->no debounce');
                // _console('e_touchMove ->no debounce');
                this._measure(_x, _y, e);

            } else {
                // 若有設置時間間隔偵 debounce
                // 避免事件過度激發
                console.log('e_touchMove ->no debounce');

                var now;
                if (!this.lockStartTime) {
                    now = this.lockStartTime = (new Date()).getTime();
                } else {
                    now = (new Date()).getTime();
                }

                var def = now - this.lockStartTime;

                // console.log('lockStartTime: ', this.lockStartTime, ',def: ', def, ',interval: ', config.interval);
                if (def > config.interval) {
                    // 超過上鎖的時間
                    // 開鎖

                    _console('<<open lock>>');

                    this.lastStep = undefined;

                    this._measure(_x, _y, e);

                    // 再次上鎖
                    this.lockStartTime = (new Date()).getTime();
                } else {
                    // 上鎖中
                    // 為了最後一次執行，雖不執行但更新數據

                    _console('lock');

                    this.lastStep = {
                        x: _x,
                        y: _y
                    };
                }
            } //----
        };
        /* ================================================================== */
        this.e_touchEnd = function(e) {
            _console('end');

            --this.jobCount;

            if (this.lastStep) {
                // 再做一次 move 計算

                _console('lastStep....');

                var _x = this.lastStep.x;
                var _y = this.lastStep.y;

                this._measure(_x, _y, e);
            }

            this.core = undefined;
            this.lastStep = undefined


            if (typeof this.config.end === 'function') {
                var cloneData = $.extend({}, this.data);

                this.config.end.call(this.dom, e, cloneData);
            }

            _console('////////////////////////////////');
        };

    }).call(TouchEvent_2.prototype);
    /* ====================================================================== */
    (function() {
        this._measure = function(_x, _y, e) {

            if(!this.core){
                return;
            }

            var data = this.data;
            var config = this.config;

            this.core.move(data, _x, _y);

            // 計算方向
            data.direction = Core.getDirection(data.dx, data.dy);

            _console('direct: ', data.direction);

            if (typeof config.move === 'function') {
                var cloneData = $.extend({}, data);
                config.move.call(this.dom, e, cloneData);
            }
        };

    }).call(TouchEvent_2.prototype);

    ////////////////////////////////////////////////////////////////////////////
    // for test
    function _console() {
        var args = [].slice.call(arguments);
        var res = '';

        args.forEach(function(arg) {
            if (typeof arg !== 'string') {
                res += JSON.stringify(arg);
            } else {
                res += arg;
            }
        });

        $(document).trigger('test', res);
    };
})(jQuery, this);
