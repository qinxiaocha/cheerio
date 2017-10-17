var eventproxy = require('eventproxy'),
  superagent = require('superagent'),
  cheerio = require('cheerio'),
  url = require('url'),
  express = require('express'),
  app = express(),
  async = require('async'),
  mongoose = require('mongoose');

var startindex = 1, //从多少页开始获取
  pagemax = 2,
  cnodeUrl = 'https://cnodejs.org/?tab=all&page=',
  topicUrls = [],
  topicTitle = [],
  topicsDetail = [],
  concurrencyCount = 0;
//获取一起有多少页
// superagent.get(cnodeUrl + 1).end(function(err, res) {
//   if (err) {
//     return console.error(err);
//   }
//   var $ = cheerio.load(res.text);
//   var pagemaxLast = $('.pagination li:last-child a').attr('href');
//   pagemax = pagemaxLast.split("&")[1].split("=")[1];
//   console.log("Successfun get pagemax " + pagemax);

// });


getTopicUrls(startindex);

//获取所有的详情页的URL
function getTopicUrls(startindex) {
  superagent.get(cnodeUrl + startindex).end(function(err, res) {
    if (err) {
      return console.error(err);
    }
    var $ = cheerio.load(res.text);
    $('#topic_list .topic_title').each(function(idx, element) {
      var $element = $(element);
      var href = url.resolve(cnodeUrl + startindex, $element.attr('href'));
      topicUrls.push(href);
      topicTitle.push({
        title: $element.attr('title'),
        href: href
      });
    });
    startindex++;
    if (startindex <= pagemax) { //如果没有获取完所有的详情页链接，则继续
      getTopicUrls(startindex); // 递归处理
      console.log("Getting all topic url ,now get page" + startindex);
    } else { //获取完所有详情页后就开始并发所有的详情页了。
      console.log("Begin to get detail content");
      // getTopicDetail();
      getDetail()
    }
  });
}
//获取详情页信息
// function getTopicDetail() {
//   var ep = new eventproxy();
//   topicUrls.forEach(function(topicUrl) {
//     superagent.get(topicUrl)
//       .end(function(err, res) {
//         console.log('fetch ' + topicUrl + ' successful');
//         try {
//           ep.emit('topic_html', [topicUrl, res.text]);
//         } catch (e) {
//           console.log(e);
//         }
//       });
//   });
//   ep.after('topic_html', topicUrls.length, function(topics) {
//     topicsDetail = topics.map(function(topicPair) {
//       var topicUrl = topicPair[0];
//       var topicHtml = topicPair[1];
//       var $ = cheerio.load(topicHtml);
//       return ({
//         title: $('.topic_full_title').text().trim(),
//         href: topicUrl,
//         comment1: $('.reply_content').eq(0).text().trim(),
//       });
//     });

//     console.log('final:');
//     console.log(topicsDetail);
//   });
// }
//控制并发
function getDetail() {
  var async = require('async');

  var concurrencyCount = 0;
  var fetchUrl = function(url, callback) {
    var delay = parseInt((Math.random() * 10000000) % 2000, 10);
    concurrencyCount++;
    console.log('现在的并发数是', concurrencyCount, '，正在抓取的是', url, '，耗时' + delay + '毫秒');
    setTimeout(function() {
      concurrencyCount--;
      superagent.get(url).end(function(err, res) {
        if (err) {
          return console.error(err);
        }
        var $ = cheerio.load(res.text);
        topicsDetail.push({
          title: $('.topic_full_title').text().trim(),
          href: url,
          comment1: $('.reply_content').eq(0).text().trim(),
        });
      });

      callback(null, url + ' html content');
    }, delay);
  };


  async.mapLimit(topicUrls, 5, function(url, callback) {
    fetchUrl(url, callback);
  }, function(err, result) {
    console.log('final:');
    console.log(result);
    mongoose.connect('mongodb://localhost/test');
    var Cat = mongoose.model('Cat', { topicsDetail: [{}] });
    var kitty = new Cat({ topicsDetail: topicsDetail });

    kitty.save(function(err) {
      if (err) { console.log(err); }
      console.log("Save to mongodb successful");
    });
  });
}

app.get('/', function(req, res) {
  res.send(topicsDetail);
});

app.listen(3000, function() {
  console.log("Please listen at port 3000");
});
