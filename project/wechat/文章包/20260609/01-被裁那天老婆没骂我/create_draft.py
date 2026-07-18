import requests
import json

ACCESS_TOKEN = "104_ZzYXlhU3X_ktxAB4BvEb2Cfnzoz0EHUNgSW9emewTkuoTMC0pMxisltANtRV9EeBiVnWfFXlHoGQopi_1TxdS1huAq5lOB8ZKDNsOE87nThRbm23y6aGTPixtL8BMJfABANYV"

# 封面图 media_id
THUMB_MEDIA_ID = "UOp6-P6dC_6DCRmUv1cIoG6rXkJ7x7OO0eN-KajHUQXGNTNzF4HffJmqhf3t5ezn"

# 文中配图URL
IMG1 = "http://mmbiz.qpic.cn/sz_mmbiz_jpg/W21ib3GLXkwT4niaDRFFYtySk54VeQEaUdLqaJkLRGwQx9HOiadgepKVHxdtLKUqE03ialOlibsqAkhiavOIYNfcO89yjAVoBSHUCuN7XicjDN3ZFs/0?from=appmsg"
IMG2 = "http://mmbiz.qpic.cn/sz_mmbiz_jpg/W21ib3GLXkwS7nNGTAGTepVdIUic471KLKwRHjqphOBD0rwPxYN5YsugrBwVtGDpjhvwGia3fW0BxSwDe7bpL88LlagibuqycrkGvUOiaTBE2ThE/0?from=appmsg"
IMG3 = "http://mmbiz.qpic.cn/sz_mmbiz_jpg/W21ib3GLXkwQOWNpHXcXE1hmmyTHaMKRTahiciajLMQicyNyxVjpYJVZyfUPrf8njibhwLFwc1k7IE0UhILFx2IZV2oLWy0qhblcj1q44D2RvJTo/0?from=appmsg"
IMG4 = "http://mmbiz.qpic.cn/sz_mmbiz_jpg/W21ib3GLXkwSgcseibE8ChqV91nZqodRU62TRhzksrZrldezrdSquo1tkaFHl40pzODlu70316SLglu3ccoWPkV3WhdIDbxEcfa8sc16G62lQ/0?from=appmsg"
IMG5 = "http://mmbiz.qpic.cn/sz_mmbiz_jpg/W21ib3GLXkwSuQs5nR79aRPf5tl5NqvOiaDJibwd1ftINHUiar6icCkpugicsiate9rLcliarQGMPqXbcFLmRwnUnL6ibf5FZUQsp8rmOjLdE12cdgCY/0?from=appmsg"

content_html = f"""
<section style="margin:0 16px;font-size:15px;color:#4a4a4a;line-height:1.75;letter-spacing:0.5px;">

  <p>接到HR消息的时候，我正在写周报。</p>
  <p>&nbsp;</p>
  <p>"方便来一下会议室吗？"微信弹出来的时候，我还在想是不是项目出了什么问题。直到推开门，看到HR旁边坐着一个我没见过的西装男，桌上放着一个信封。</p>
  <p>&nbsp;</p>
  <p>那一刻心跳确实漏了一拍，但我没有很意外。</p>
  <p>&nbsp;</p>
  <p>公司已经连续两个季度亏损，隔壁组的同事上个月走了一半。我一直觉得自己是安全的那一批——毕竟刚带完一个还不错的项目，绩效也排在中上。但西装男开口第一句话就是："公司感谢你三年来的付出..."</p>
  <p>&nbsp;</p>
  <p>后面的每个字都像隔了一层玻璃，闷闷的，听不太清。我只记得自己说了句"好的"，签了字，拿起信封走出了会议室。走廊里我停下来看了一眼手机——下午三点十四分。同事们还在工位上敲键盘，没人注意到我刚丢了一份工作。</p>
  <p>&nbsp;</p>
  <p>我打车回家，比平时早了三个小时。路上我一直在想一个问题：<strong>待会怎么跟老婆说。</strong></p>
  <p>&nbsp;</p>
  <p>我们刚换了房贷利率更高的还款方案，孩子九月份要上幼儿园，我妈上次体检的复查还没去。这些数字在我脑子里转来转去，跟打车软件的计费器一样往上跳。</p>
  <p>&nbsp;</p>

  <p style="text-align:center;">
    <img src="{IMG1}" style="width:100%;" alt="空荡的办公室" />
  </p>
  <p style="font-size:14px;color:#888;text-align:center;">那天下午三点十四分，走廊里一个人都没有</p>
  <p>&nbsp;</p>

  <p>推开门的时候，她在厨房炖汤。听到动静探出头来，看到是我，明显愣了一下。</p>
  <p>&nbsp;</p>
  <p>"今天这么早？"</p>
  <p>&nbsp;</p>
  <p>"嗯。被裁了。"</p>
  <p>&nbsp;</p>
  <p>说完这两个字，我没看她。我换了拖鞋，走到沙发上坐下，打开手机假装在看什么东西。厨房里的动静停了两秒钟，然后汤锅又咕嘟咕嘟地响了起来。</p>
  <p>&nbsp;</p>
  <p>她把火关小，擦了擦手走出来，坐在我旁边。我等着她问"为什么是你""房贷怎么办""接下来怎么打算"。</p>
  <p>&nbsp;</p>
  <p>但她什么都没问。</p>
  <p>&nbsp;</p>
  <p>她拿起手机，当着我的面打开了淘宝购物车。</p>
  <p>&nbsp;</p>
  <p>那个购物车我们一起攒了很久——她要的吹风机、我想要的机械键盘、给孩子准备的学习桌、下个月我妈生日想买的按摩仪。加加减减，一直没舍得清。</p>
  <p>&nbsp;</p>
  <p>她没说话，一个一个删掉。机械键盘，删了。按摩仪，删了。那个她加了一年的吹风机，平时总是说"再看吧等双十一"，现在也被她删掉了。</p>
  <p>&nbsp;</p>
  <p><strong>最后删得只剩孩子的学习桌。</strong></p>
  <p>&nbsp;</p>
  <p>"这个不能删，孩子要用。"她说这句话的时候语气很平淡。</p>
  <p>&nbsp;</p>

  <p style="text-align:center;">
    <img src="{IMG2}" style="width:100%;" alt="温暖的家" />
  </p>
  <p style="font-size:14px;color:#888;text-align:center;">厨房的汤还咕嘟咕嘟地响着</p>
  <p>&nbsp;</p>

  <p>说真的我不知道该怎么形容那个瞬间的心情。不是感动，也不是愧疚。是一种很具体的心酸——你以为自己撑得住，但有人已经在默默帮你做减损了。</p>
  <p>&nbsp;</p>
  <p>后来我才知道，那天晚上她给娘家打了个电话，说"最近先不回去吃饭了，我们这边有点事"。没细说，没抱怨，没让我接电话。挂了之后她继续给我盛汤，好像什么都没发生。</p>
  <p>&nbsp;</p>
  <p>其实很多男人在职场混了几年后会有一种错觉——觉得自己是这个家的支柱，在撑着一切。但真正塌下来的时候你才发现，<strong>撑住局面的人往往不是你。</strong></p>
  <p>&nbsp;</p>
  <p>你只是在外面挨了一拳。而她在里面，已经把接下来的每一笔账都算好了，把每一个可以砍的念头都先砍在了自己身上。</p>
  <p>&nbsp;</p>

  <p style="text-align:center;">
    <img src="{IMG3}" style="width:100%;" alt="手机屏幕" />
  </p>
  <p style="font-size:14px;color:#888;text-align:center;">有些东西删了就删了，有些东西删不掉</p>
  <p>&nbsp;</p>

  <p style="font-size:17px;font-weight:bold;color:#be185d;">公司给你的评价，不是你全部的价值</p>
  <p>&nbsp;</p>
  <p>说这些不是想卖惨。</p>
  <p>&nbsp;</p>
  <p>这三年在大厂，说实话学到的东西不少。但被裁之后我才开始重新审视一件事——<strong>我一直以为自己的安全感来自工资卡上的数字，但真正让我有安全感的，是那个在危机时刻不动声色帮我清空购物车的人。</strong></p>
  <p>&nbsp;</p>
  <p>以前我总觉得，职场上的成长就是title往上走、工资往上涨。那天之后我发现还有一种成长叫做：意识到你的价值不止在公司对你的评价里。你值多少钱，跟你值不值得被好好对待，是两回事。</p>
  <p>&nbsp;</p>
  <p>说实话，我到现在都没想好要不要感谢那次被裁。它让我失去了一份工作，也让我看清楚了一些东西。比如我老婆比我以为的更冷静，比如我以前对职场的很多焦虑其实放错了地方。</p>
  <p>&nbsp;</p>
  <p>被裁不是最难的事。最难的是被裁之后，面对那笔还没还完的房贷，面对那些删掉的购物车，面对那个什么都没说但什么都做了的人。你得配得上这份沉默，而且得用行动去证明。</p>
  <p>&nbsp;</p>

  <p style="text-align:center;">
    <img src="{IMG4}" style="width:100%;" alt="窗外夜景" />
  </p>
  <p style="font-size:14px;color:#888;text-align:center;">有些问题，一个人看夜景的时候才想得明白</p>
  <p>&nbsp;</p>

  <p style="font-size:17px;font-weight:bold;color:#be185d;">购物车可以再填满</p>
  <p>&nbsp;</p>
  <p>最近我已经开始新的工作了，工资比以前低了一点，但离家近了四十分钟。每天六点钟能到家，陪孩子吃顿饭，周末也不用盯着钉钉。老婆的购物车里又慢慢加回来了，这次我把机械键盘删了——用不上，家里那把还能用。</p>
  <p>&nbsp;</p>
  <p>至于那个吹风机，双十一的时候我偷偷帮她买回来了。</p>
  <p>&nbsp;</p>
  <p>她拆快递的时候笑了，说"你疯啦这个很贵的"。我说没事，咱俩的购物车，以后我来清。</p>
  <p>&nbsp;</p>

  <p style="text-align:center;">
    <img src="{IMG5}" style="width:100%;" alt="温馨家庭" />
  </p>
  <p style="font-size:14px;color:#888;text-align:center;">购物车可以再填满。有些东西不行。</p>
  <p>&nbsp;</p>

  <p style="text-align:center;font-size:16px;color:#be185d;">
    <strong>在公司你是一个可以被替代的工号，<br/>但在有一个人眼里，你无可替代。<br/>别搞反了。</strong>
  </p>
  <p>&nbsp;</p>

  <p style="text-align:center;color:#888;font-size:14px;">
    点个「在看」，让我知道你也在想这个问题
  </p>

</section>
"""

data = {
    "articles": [{
        "title": "被裁那天，老婆没骂我，只是默默把购物车清空了",
        "author": "",
        "digest": "公司赔了我N+1。但那天晚上她打开淘宝购物车，一个一个删掉我们攒了很久的东西——只剩孩子的学习桌。",
        "content": content_html,
        "content_source_url": "",
        "thumb_media_id": THUMB_MEDIA_ID,
        "need_open_comment": 1,
        "only_fans_can_comment": 0,
    }]
}

url = f"https://api.weixin.qq.com/cgi-bin/draft/add?access_token={ACCESS_TOKEN}"
resp = requests.post(url, json=data)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
