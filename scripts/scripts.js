"use strict";angular.module("clientApp",["ngAnimate","ngCookies","ngSanitize","config","cm.angularHttpPlus","leaflet-directive","LocalStorageModule","ui.router","angular-loading-bar"]).config(["$stateProvider","$urlRouterProvider","$httpProvider","cfpLoadingBarProvider",function(a,b,c,d){var e=["$state","Auth","$timeout",function(a,b,c){b.isAuthenticated()||c(function(){a.go("403")})}];a.state("homepage",{url:"",controller:"HomepageCtrl",resolve:{account:["Account",function(a){return a.get()}]}}).state("login",{url:"/login",templateUrl:"views/login.html",controller:"LoginCtrl"}).state("screenshots",{url:"/screenshots/:testId",templateUrl:"views/dashboard/screenshots/screenshots.html",controller:"ScreenshotsCtrl",resolve:{screenshots:["Screenshots","$stateParams",function(a,b){return a.get("company",b.testId)}]}}).state("dashboard",{"abstract":!0,url:"",templateUrl:"views/dashboard/main.html",controller:"DashboardCtrl",onEnter:e,resolve:{account:["Account",function(a){return a.get()}],selectedCompany:["$stateParams",function(a){return a.companyId}]}}).state("dashboard.byCompany",{url:"/dashboard/{companyId:int}","abstract":!0,template:"<ui-view/>",resolve:{mapConfig:["Map",function(a){return a.getConfig()}],authors:["$stateParams","Events",function(a,b){return b.getAuthors(a.companyId)}]}}).state("dashboard.byCompany.events",{url:"/events",templateUrl:"views/dashboard/events/events.html",controller:"EventsCtrl",onEnter:e,resolve:{events:["$stateParams","Events",function(a,b){return b.get(a.companyId)}]}}).state("dashboard.byCompany.byUser",{url:"/user/{userId:int}","abstract":!0,template:"<ui-view/>"}).state("dashboard.byCompany.byUser.events",{url:"/events",templateUrl:"views/dashboard/events/events.html",controller:"EventsCtrl",onEnter:e,resolve:{events:["$stateParams","Events",function(a,b){return b.get(a.companyId,a.userId)}]}}).state("dashboard.byCompany.byUser.events.event",{url:"/event/{eventId:int}",controller:"EventsCtrl"}).state("dashboard.byCompany.events.event",{url:"/event/{eventId:int}",controller:"EventsCtrl"}).state("dashboard.companies",{url:"/companies",templateUrl:"views/dashboard/companies/companies.html",controller:"CompaniesCtrl",onEnter:e,resolve:{companies:["Companies",function(a){return a.get()}]}}).state("dashboard.companies.company",{url:"/{id:int}",templateUrl:"views/dashboard/companies/companies.company.html",controller:"CompaniesCtrl",onEnter:e}).state("dashboard.account",{url:"/my-account",templateUrl:"views/dashboard/account/account.html",controller:"AccountCtrl",onEnter:e,resolve:{account:["Account",function(a){return a.get()}]}}).state("403",{url:"/403",templateUrl:"views/403.html"}),b.otherwise("/"),c.interceptors.push(["$q","Auth","localStorageService",function(a,b,c){return{request:function(a){return a.url.match(/login-token/)||(a.headers={"access-token":c.get("access_token")}),a},response:function(a){return a.data.access_token&&c.set("access_token",a.data.access_token),a},responseError:function(c){return 401===c.status&&b.authFailed(),a.reject(c)}}}]),d.includeSpinner=!1,d.latencyThreshold=1e3}]).run(["$rootScope","$state","$stateParams","$log","Config",function(a,b,c,d,e){a.$state=b,a.$stateParams=c,e.debugUiRouter&&(a.$on("$stateChangeStart",function(a,b,c){d.log("$stateChangeStart to "+b.to+"- fired when the transition begins. toState,toParams : \n",b,c)}),a.$on("$stateChangeError",function(){d.log("$stateChangeError - fired when an error occurs during transition."),d.log(arguments)}),a.$on("$stateChangeSuccess",function(a,b){d.log("$stateChangeSuccess to "+b.name+"- fired once the state transition is complete.")}),a.$on("$viewContentLoaded",function(a){d.log("$viewContentLoaded - fired after dom rendered",a)}),a.$on("$stateNotFound",function(a,b,c,e){d.log("$stateNotFound "+b.to+"  - fired when a state cannot be found by its name."),d.log(b,c,e)}))}]),angular.module("clientApp").controller("CompaniesCtrl",["$scope","companies","$stateParams","$log",function(a,b,c){a.companies=b,a.selectedCompany=null;var d=function(b){a.selectedCompany=null,angular.forEach(a.companies,function(c){c.id==b&&(a.selectedCompany=c)})};c.id&&d(c.id)}]),angular.module("clientApp").controller("ScreenshotsCtrl",["$scope","screenshots","Auth","filterFilter","Zip","$state","$stateParams","$log",function(a,b,c,d,e){a.showDiff=!1,a.screenshots=b.data,angular.forEach(a.screenshots,function(b,c){a.screenshots[c].selected=!1}),a.selection=[],a.selectedScreenshots=function(){return d(a.screenshots,{selected:!0})},a.$watch("screenshots|filter:{selected:true}",function(b){a.selection=b.map(function(a,b){return b})},!0),a.zip=function(){var b=a.selectedScreenshots();if(b){var d=[];b.forEach(function(a){var b={url:a.regression.self+"?access_token="+c.getAccessToken(),filename:a.baseline_name};d.push(b)}),e.createZip(d)}}}]),angular.module("clientApp").controller("LoginCtrl",["$scope","Auth","$state",function(a,b,c){a.loginButtonEnabled=!0,a.loginFailed=!1,a.login=function(d){a.loginButtonEnabled=!1,b.login(d).then(function(){c.go("homepage")},function(){a.loginButtonEnabled=!0,a.loginFailed=!0})}}]),angular.module("clientApp").service("Auth",["$injector","$rootScope","Utils","localStorageService","Config",function(a,b,c,d,e){this.login=function(b){return a.get("$http")({method:"GET",url:e.backend+"/api/login-token",headers:{Authorization:"Basic "+c.Base64.encode(b.username+":"+b.password)}})},this.logout=function(){d.remove("access_token"),b.$broadcast("clearCache"),a.get("$state").go("login")},this.isAuthenticated=function(){return!!d.get("access_token")},this.authFailed=function(){this.logout()},this.getAccessToken=function(){return d.get("access_token")}}]),angular.module("clientApp").service("Utils",function(){var a=this;this.Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(b){var c,d,e,f,g,h,i,j="",k=0;for(b=a.Base64._utf8_encode(b);k<b.length;)c=b.charCodeAt(k++),d=b.charCodeAt(k++),e=b.charCodeAt(k++),f=c>>2,g=(3&c)<<4|d>>4,h=(15&d)<<2|e>>6,i=63&e,isNaN(d)?h=i=64:isNaN(e)&&(i=64),j=j+this._keyStr.charAt(f)+this._keyStr.charAt(g)+this._keyStr.charAt(h)+this._keyStr.charAt(i);return j},_utf8_encode:function(a){a=a.replace(/\r\n/g,"\n");for(var b="",c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b+=String.fromCharCode(d):d>127&&2048>d?(b+=String.fromCharCode(d>>6|192),b+=String.fromCharCode(63&d|128)):(b+=String.fromCharCode(d>>12|224),b+=String.fromCharCode(d>>6&63|128),b+=String.fromCharCode(63&d|128))}return b}}}),angular.module("clientApp").service("Screenshots",["$q","$http","$timeout","Config","$rootScope","$log",function(a,b,c,d,e){function f(c,e){var f=c+":"+e,g=a.defer(),h=d.backend+"/api/screenshots",j={sort:"-updated","filter[git_commit]":e};return b({method:"GET",url:h,params:j}).success(function(a){i(f,a),g.resolve(a)}),g.promise}var g={},h="BoomScreenshotsChange";this.get=function(b,c){var d=b+":"+c;return g&&g[d]?a.when(g[d].data):f(b,c)},this.getAuthors=function(b){var c=a.defer(),d={};return this.get(b).then(function(a){angular.forEach(a,function(a){d[a.user.id]={id:parseInt(a.user.id),name:a.user.label,count:d[a.user.id]?++d[a.user.id].count:1}}),c.resolve(d)}),c.promise};var i=function(a,b){g[a]={data:b,timestamp:new Date},c(function(){g.data&&g.data[a]&&(g.data[a]=null)},6e4),e.$broadcast(h)};e.$on("clearCache",function(){g={}})}]),angular.module("clientApp").service("Companies",["$q","$http","$timeout","Config","$rootScope",function(a,b,c,d,e){var f={},g="BoomCompaniesChange";this.get=function(){return a.when(f.data||h())};var h=function(){var c=a.defer(),e=d.backend+"/api/companies";return b({method:"GET",url:e}).success(function(a){i(a.data),c.resolve(a.data)}),c.promise},i=function(a){f={data:a,timestamp:new Date},c(function(){f.data=void 0},6e4),e.$broadcast(g)};e.$on("clearCache",function(){f={}})}]),angular.module("clientApp").service("Map",["leafletData",function(a){var b={};this.getConfig=function(){return{zoomControlPosition:"bottomleft",maxZoom:16,minZoom:1,center:this.getCenter()}},this.setCenter=function(a){b.center=a},this.getCenter=function(){return b.center||{lat:60,lng:60,zoom:4}},this.centerMapByMarker=function(b){a.getMap().then(function(a){a.setView(b.getPosition())})}}]),angular.module("clientApp").factory("Marker",["$state","Map",function(a,b){function c(a){return e[a]}var d,e={"default":{iconUrl:"/images/marker-blue.png",shadowUrl:"/images/shadow.png",iconSize:[40,40],shadowSize:[26,26],iconAnchor:[32,30],shadowAnchor:[25,7]},selected:{iconUrl:"/images/marker-red.png",shadowUrl:"/images/shadow.png",iconSize:[40,40],shadowSize:[26,26],iconAnchor:[32,30],shadowAnchor:[25,7]}};return{unselect:function(){this.icon=c("default")},select:function(){angular.isDefined(d)&&d.unselect(),d=this,this.icon=c("selected"),b.centerMapByMarker(this)},getPosition:function(){return{lat:this.lat,lng:this.lng}}}}]),angular.module("clientApp").controller("DashboardCtrl",["$scope","account","selectedCompany","Auth","$state","$log",function(a,b,c,d,e){a.companies=b.companies,a.selectedCompany=c?c:parseInt(b.companies[0].id),a.logout=function(){d.logout(),e.go("login")}}]),angular.module("clientApp").directive("spinner",function(){return{template:'<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>',restrict:"E"}}),angular.module("clientApp").directive("loadingBarText",function(){return{restrict:"EA",template:'<div class="splash-screen" ng-show="isLoading">{{text}}</div>',controller:["$scope",function(a){function b(b){a.isLoading=b}a.text="loading...",a.isLoading=!1,a.$on("cfpLoadingBar:started",function(){b(!0)}),a.$on("cfpLoadingBar:completed",function(){b(!1)})}],scope:{}}}),angular.module("clientApp").controller("AccountCtrl",["$scope","account",function(a,b){a.account=b}]),angular.module("clientApp").service("Account",["$q","$http","$timeout","Config","$rootScope","$log",function(a,b,c,d,e){function f(){var c=a.defer(),e=d.backend+"/api/me/";return b({method:"GET",url:e,transformResponse:g}).success(function(a){i(a[0]),c.resolve(a[0])}),c.promise}function g(a){return(a=angular.fromJson(a).data)?(angular.forEach(a[0].companies,function(b,c){a[0].companies[c].id=parseInt(b.id)}),a):void 0}var h={};this.get=function(){return a.when(h.data||f())};var i=function(a){h={data:a,timestamp:new Date},c(function(){h={}},6e4),e.$broadcast("gb.account.changed")};e.$on("clearCache",function(){h={}})}]),angular.module("clientApp").controller("HomepageCtrl",["$scope","$state","account","$log",function(a,b,c){c||b.go("login")}]),angular.module("clientApp").directive("beforeAfterImageSlider",function(){return{scope:{first:"@",second:"@",width:"@",height:"@"},template:'<div class="before-after-slider"><div class="first-wrapper"><img ng-src="{{ first }}" width="{{ width }}" height="{{ height }}" alt="first" /></div><div class="second-wrapper"><img ng-src="{{ second }}" width="{{ width }}" height="{{ height }}"  alt="second" /></div></div>',link:function(a,b){var c=b.find(".second-wrapper"),d=b.find(".second-wrapper img").width(),e=Math.round(d/2);c.width(e),b.find(".before-after-slider").mousemove(function(a){var b=a.offsetX||a.clientX-c.offset().left;c.width(b)})}}}),angular.module("clientApp").service("Zip",["$q",function(a){function b(b,c,d){var e=a.defer();return JSZipUtils.getBinaryContent(b,function(a,b){a?e.reject(a):(d.file(c,b,{binary:!0}),e.resolve(b))}),e.promise}this.createZip=function(c){var d=new JSZip,e=[];c.forEach(function(a){e.push(b(a.url,a.filename,d))}),a.all(e).then(function(){var a=d.generate({type:"blob"});saveAs(a,"boom.zip")})}}]);