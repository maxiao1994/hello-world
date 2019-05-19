const express =require("express");
const session = require("express-session");
const formidable = require("formidable");
const fs = require("fs");
const crypto = require("crypto");
const gm = require("gm");
const path = require("path");
const url = require("url");
const app = express();

//开静态
app.use(express.static("./"));

//配置session，固定语法
app.set("trust proxy",1);
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized:true
}));

//执行登录
app.post("/login",(res,req)=>{
    //得到POST请求的username和password
    var form = new formidable.IncomingForm();
    form.parse(req,(err,fields)=>{
        const username = fileds.username;
        const password = fileds.password;
        //给用户传上来密码加密
        const password_sha256 = crypto.createHash("sha256").update(password+""+password).digest("hex");
        //使用fs模块读取小数据库 依次比对 看看他是谁
        fs.readFile("./db/users.txt",(err,content)=>{
            var arr = JSON.parse(content.toString());
            //依次比对
            for(let i =0;i<arr.length;i++){
                if(arr[i].username==username&&arr[i].password==password_sha256){
                    //匹配了 下发session是对这个用户的最高奖赏
                    req.session.login = true;
                    req.session.username = username;
                    //返回结果
                    res.json({"result":1});
                    //不再执行了
                    return;
                }
            }
            //程序执行到这里 表示没有找到匹配的人
            //返回错误结果
            res.json({"result":-1});
        });
    });
});

//查询当前登录的人信息
app.get("/me",(req,res)=>{
    //先看有没有session
    if(req.session.login=true){
        //查询数据库 差更多这个人信息
        fs.readFile("./db/users.txt",(err,content)=>{
            var arr = JSON.parse(content.toString());
            for(let i =0;i<arr.length;i++){
                if(arr[i].username == req.session.username){
                    //匹配了
                    //返回结果
                    res.json({
                        "nickname":arr[i].nickname,
                        "avartar":arr[i].avartar,
                        "username":arr[i].username
                    });
                }
            }
        });
    }else{
        res.json({"err":-4});
    }
});

//上传
app.post("/uploadavatar",(req,res)=>{
    var form = new formidable.IncomingForm();
    //设置上传目录
    form.uploadDir = "./uploads";
    //保留扩展名
    form.keepExtensions = true;

    form.parse(req,(err,fields,files)=>{
        if(files.file.type!="images/jpeg"&&files.file.type!="images/png"){
            //图片类型不对
            res.json({"result":-3});
        }else if(files.file.size>200*1024){
            //图片文件体积不能超过200KB
            res.json({"result":-2});
        }else{
            //文件宽度和高度尺寸
            gm(path.resolve(__dirname,files.file.path)).size((err,size)=>{
                if(size.width>=100&&size.width<=1500&&size.height>=100&&size.height<=1500){
                    //成功了 向前端毁掉文件尺寸、宽度和高度、文件名
                    res.json({
                        "result":1,
                        "width":size.width,
                        "height":size.height,
                        "filename":path.basename(files.file.path)//只给前端文件名即可 路径不用给
                    });
                }else{
                    //图片宽度和高度不在范围内
                    res.json({"result":-4});
                }
            })
        }
    })
});

//裁图接口
app.post("/cutavatarandsetavatar",(req,res)=>{
    //收到前端发来的6各参数
    var form = new formidable.IncomingForm();
    form.parse(req,(err,fields,files)=>{
        //切片宽度 高度是相通的
        const cW = Number(fields.cW);
        //切片左上角x位置
        const dX = Number(fields.dX);
        //切片左上角y位置
        const dY = Number(fields.dY);
        //原图宽度
        const picRealWidth = Number(fields.picRealWidth);
        //显示图片宽度
        const picShowWidth = Number(fields.picShowWidth);
        //图片文件名
        const filename = fields.filename;
        //计算比例
        const rate = picRealWidth/picShowWidth;
        //裁切
        gm(path.resolve(__dirname,"uploads/"+filename))
        .crop(cW*rate,cW*rate,dX*rate,dY*rate)
        .resize(100,100,'!')
        .write(path.resolve(__dirname,"uploads/"+filename),function(err){
            //写数据库
            //使用fs模块读取小数据库 依次比对 看看是谁
            fs.readFile("./db/users.txt",(err,content)=>{
                var arr = JSON.parse(content.toString());
                //依次比对
                for(let i =0;i<arr.length;i++){
                    if(arr[i].username == req.session.username){
                        //更改这项avatar
                        arr[i].avartar = "uploads/"+filename;
                    }
                }
                fs.writeFile("./db/users.txt",JSON.stringify(arr),function(){
                    res.json({"result":1});
                })
            })
        })
    })
})

//查询某人资料
app.get("/profile/:username",(req,res)=>{
    //先看看有没有session
    if(req.session.login=true){
        //查询数据库 查更多这个人的信息
        fs.readFile("./db/users.txt",(err,content)=>{
            var arr = JSON.parse(content.toString());
            for(let i= 0;i<arr.length;i++){
                if(arr[i].username == req.params.username){
                    //匹配了
                    //返回结果
                    res.json({
                        "result":1,
                        "username":arr[i].username,
                        "nickname":arr[i].nickname,
                        "avatar":arr[i].avatar,
                        "idcard":arr[i].idcard,
                        "sex":arr[i].sex,
                        "age":arr[i].age,
                        "signature":arr[i].signature,
                        "qq":arr[i].qq,
                        "weixin":arr[i].weixin,
                        "mobile":arr[i].mobile
                    });
                    return;
                }
            }
            //没有找到这个人
            res.json({
                "result":"-3"
            });
        });
    }else{
        res.json({"err":-4})
    }
})

//更改某人资料
app.post("/profile/:username",(req,res)=>{
    //通过formidable得到提交上来的参数
    var form = new formidable.IncomingForm();
    form.parse(req,(err,field,files)=>{
        //查询数据库 差更多这个人信息
        fs.readFile("./db/users.txt",(err,content)=>{
            var arr = JSON.parse(content.toString());
            for(let i =0;i<arr.length;i++){
                if(arr[i].username == req.params.username){
                    //改变这个对象
                    arr[i] = Object.assign(arr[i],fields);
                }
            }
            fs.writeFile("./db/users.txt",JSON.stringify(arr),function(){
                res.json({"result":1});
            })
        })
    })
});

//检查昵称是否有重复的
app.get("checknickname",(req,res)=>{
    //得到get请求参数 好比PHP中的$_get["nickname"]
    var nickname = url.parse(req.url,true).query.nickname;
    var username = url.parse(req.url,true).query.nickname;
    //读取数据看 看看有没有nickname一样的
    fs.readFile("./db/users.txt",(err,content)=>{
        var arr = JSON.parse(content.toString());
        for(let i =0;i<arr.length;i++){
            if(arr[i].username!=username&&arr[i].nickname==nickname){
                res.send("yes");
                return;;
            }
        }
        res.send("no");
    })
})
app.listen(3000);