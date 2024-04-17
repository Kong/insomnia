const { Octokit } = require('@octokit/rest');

const owner = 'kong';
const repo = 'insomnia';
const sinceTag = process.env.SINCE;// 'v8.5.0';
const prNumber = process.env.PR;// 7262;
const token = process.env.GITHUB_TOKEN;
if (!sinceTag) {
  console.error('Please provide SINCE env variable');
  process.exit(1);
}
if (!prNumber) {
  console.error('Please provide PR env variable');
  process.exit(1);
}
if (!token) {
  console.error('Please provide GITHUB_TOKEN env variable');
  process.exit(1);
}

const octokit = new Octokit({
  auth: token,
});

async function getPrTitles(owner, repo, sinceTag) {
  try {
    // Get the commits since the specified tag
    const commitsResponse = await octokit.repos.listCommits({
      owner,
      repo,
      since: sinceTag,
    });

    const prTitles = commitsResponse.data
      .map(commit => {
        const newLinePosition = commit.commit.message.indexOf('\n');
        if (newLinePosition !== -1) {
          return commit.commit.message.slice(0, newLinePosition + 1);
        }
        return commit.commit.message;
      })
      .map(title => '- ' + title.trim());

    return prTitles;
  } catch (error) {
    console.error('Error fetching PR titles:', error.message);
    return [];
  }
}
async function postCommentOnPR(owner, repo, prNumber, comment) {
  try {
    const response = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment,
    });

    console.log('Comment posted successfully:', response.data.html_url);
  } catch (error) {
    console.error('Error posting comment:', error.message);
  }
}

getPrTitles(owner, repo, sinceTag)
  .then(prTitles => {
    console.log('PR Titles since', sinceTag, ':');
    prTitles.forEach(title => console.log(title));
    // postCommentOnPR(owner, repo, prNumber, prTitles.join('\n'));
  })
  .catch(err => {
    console.error('Error:', err);
  });
