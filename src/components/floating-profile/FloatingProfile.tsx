import styles from "./FloatingProfile.module.scss";
import { For, JSX, Match, Show, Switch, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import Icon from "../ui/icon/Icon";
import Text from "../ui/Text";
import { calculateTimeElapsedForActivityStatus } from "@/common/date";
import useStore from "@/chat-api/store/useStore";
import { useCustomPortal } from "../ui/custom-portal/CustomPortal";
import { UserDetails, getUserDetailsRequest } from "@/chat-api/services/UserService";
import { useWindowProperties } from "@/common/useWindowProperties";
import { useResizeObserver } from "@/common/useResizeObserver";
import Modal from "../ui/modal/Modal";
import RouterEndpoints from "@/common/RouterEndpoints";
import { Banner } from "../ui/Banner";
import { CustomLink } from "../ui/CustomLink";
import Avatar from "../ui/Avatar";
import UserPresence from "../user-presence/UserPresence";
import { Markup } from "../Markup";
import { PostItem } from "../PostsArea";
import { bannerUrl } from "@/chat-api/store/useUsers";
import { ServerMemberRoleModal } from "../member-context-menu/MemberContextMenu";
import { electronWindowAPI } from "@/common/Electron";
import { classNames } from "@/common/classNames";
import { useLocation } from "solid-navigator";



interface Props {
  dmPane?: boolean
  position?: {left: number, top: number; anchor?: "left" | "right"};
  userId: string;
  serverId?: string;
  close?: () => void;
  triggerEl?: HTMLElement;
}


export const ProfileFlyout = (props: Props) => {
  const { isMobileWidth } = useWindowProperties();
  const location = useLocation();


  const showMobileFlyout = () => {
    if (props.dmPane) return false;
    return isMobileWidth()
  }

  const memoShowMobileFlyout = createMemo(() => showMobileFlyout());

  const onPathChange = () => {
    return location.pathname + location.search + location.query
  }

  createEffect(on([memoShowMobileFlyout, onPathChange],  () => {
    props.close?.();
  }, {defer: true}))

  return (
    <Switch>
      <Match when={!showMobileFlyout()}><DesktopProfileFlyout triggerEl={props.triggerEl} close={props.close} anchor={props.position?.anchor} left={props.position?.left} top={props.position?.top} dmPane={props.dmPane} userId={props.userId} serverId={props.serverId} /></Match>
      <Match when={showMobileFlyout()}>
        <MobileFlyout close={props?.close} serverId={props.serverId} userId={props.userId}  />
      </Match>
    </Switch>
  )

}


const DesktopProfileFlyout = (props: { triggerEl?: HTMLElement, dmPane?: boolean; mobile?: boolean; close?(): void, userId: string, serverId?: string, left?: number, top?: number; anchor?: "left" | "right" }) => {
  const { createPortal } = useCustomPortal();
  const { users, account, serverMembers, posts } = useStore();
  const [details, setDetails] = createSignal<UserDetails | undefined>(undefined);
  const [hover, setHover] = createSignal(false);
  const { height } = useWindowProperties();
  const isMe = () => account.user()?.id === props.userId;
  const { isMobileWidth } = useWindowProperties();
  
  const isMobileWidthMemo = createMemo(() => isMobileWidth())
  createEffect(on(isMobileWidthMemo, (input, prevInput) => {
    props.close?.();
  }, {defer: true}))


  const user = () => {
    if (details()) return details()?.user
    if (isMe()) return account.user();
    const user = users.get(props.userId)
    if (user) return user;
  };

  const member = () => props.serverId ? serverMembers.get(props.serverId, props.userId) : undefined;

  createEffect(on(() => props.userId, async() => {
    setDetails(undefined);
    const details = await getUserDetailsRequest(props.userId);
    setDetails(details)
    if (!details.latestPost) return;
    posts.pushPost(details.latestPost)
  }))

  const latestPost = () => posts.cachedPost(details()?.latestPost?.id!);


  const followingCount = () => details()?.user._count.following.toLocaleString()
  const followersCount = () => details()?.user._count.followers.toLocaleString()


  const [flyoutRef, setFlyoutRef] = createSignal<HTMLDivElement | undefined>(undefined);
  const { height: flyoutHeight} = useResizeObserver(flyoutRef);


  createEffect(() => {
    if (!flyoutRef()) return;
    if (props.mobile) return;
    let newTop = props.top!;
    if ((flyoutHeight() + props.top!) > height()) newTop = height() - flyoutHeight() - (electronWindowAPI()?.isElectron ? 35 : 0);
    flyoutRef()!.style.top = newTop + "px";
  })


  onMount(() => {
    document.addEventListener("mouseup", onBackgroundClick)
    onCleanup(() => {
      document.removeEventListener("mouseup", onBackgroundClick)
    })
  })

  const onBackgroundClick = (event: MouseEvent) => {
    if (props.mobile) return;
    if (event.target instanceof Element) {
      if (event.target.closest(".modal-bg")) return;
      if (event.target.closest(".modal")) return;
      if (event.target.closest(`.${styles.flyoutContainer}`)) return;
      if (props.triggerEl) {
        if (event.target.closest(`.trigger-profile-flyout`) === props.triggerEl.closest(`.trigger-profile-flyout`)) return;
      }
      props.close?.()
    };
  }

  const left = () => {
    if (props.anchor == "left") return props.left + "px";
    return (props.left! - 350) + "px";

  }


  const style = () => ({
    left: left(),
    ...(props.mobile ? {
      top: 'initial',
      bottom: "0",
      left: "0",
      right: "0",
      width: "initial",
      "align-items": "initial",
      "max-height": "70%",
      height: 'initial'
    } : undefined),
    ...(props.dmPane ? {
      position: 'relative',
      width: "initial",
      height: 'initial',
      "z-index": 1
    } : undefined)
  }) as JSX.CSSProperties

  const showRoleModal = () => {
    createPortal?.(close =>  <ServerMemberRoleModal close={close} userId={member()?.userId!} serverId={member()?.serverId!} />);
  }


  const ProfileArea = () => (
    <>
      <Banner maxHeight={200} margin={0} animate={!props.dmPane ? true : hover()} hexColor={user()?.hexColor} url={bannerUrl(user()!)} />
      <div class={styles.flyoutDetailsContainer}>
        <CustomLink href={RouterEndpoints.PROFILE(props.userId)}>
          <Avatar animate class={styles.flyoutAvatarStyles} user={user()!} size={60} />
        </CustomLink>
        <div class={styles.flyoutOtherDetailsContainer}>
          <span>
            <CustomLink decoration style={{ color: 'white' }} href={RouterEndpoints.PROFILE(props.userId)}>
              <Text style={{ "overflow-wrap": "anywhere" }}>{user()!.username}</Text>
              <Text color='rgba(255,255,255,0.6)'>:{user()!.tag}</Text>
            </CustomLink>
          </span>
          <UserPresence hideActivity animate userId={props.userId} showOffline />
          <Text size={12} opacity={0.6}>{followingCount()} Following | {followersCount()} Followers</Text>
        </div>
      </div>

      <Show when={member()}>
        <FlyoutTitle style={{ "margin-bottom": "5px" }} icon='leaderboard' title='Roles' />
        <div class={styles.rolesContainer}>
          <For each={member()?.roles()!}>
            {role => (<div class={styles.roleContainer}><Text color={role?.hexColor} size={12}>{role?.name}</Text></div>)}
          </For>
          <div class={classNames(styles.roleContainer, styles.selectable)}  onclick={showRoleModal}><Icon name='add' size={14} /></div>
        </div>
      </Show>

      <UserActivity userId={props.userId} />

      <Show when={details()?.profile?.bio}>
        <FlyoutTitle icon='info' title='Bio' />
        <div class={styles.bioContainer}>
          <Text size={12} color='rgba(255,255,255,0.7)'><Markup text={details()?.profile?.bio!} /></Text>
        </div>
      </Show>


    </>
  );

  const PostArea = () => (
    <>
      <FlyoutTitle style={{ "margin-bottom": "5px" }} icon='chat' title='Latest Post' />
      <PostItem post={latestPost()!} />
    </>
  )

  return (
    <Show when={details()}>
      <div onMouseEnter={() => setHover(true)} onMouseLeave={(() => setHover(false))} ref={setFlyoutRef} class={classNames("modal", styles.flyoutContainer)} style={style()}>
        <div 
          class={styles.flyoutInnerContainer} 
          classList={{
            [styles.dmPane]: props.dmPane,
            [styles.mobile]: props.mobile
          }} 
          style={{ width: 'initial', flex: 1 }}
        >
          <ProfileArea />
          <Show when={latestPost()}>
            <PostArea />
          </Show>
        </div>
      </div>
    </Show>
  )
}



function MobileFlyout(props: { userId: string, serverId?: string, close?: () => void }) {
  let mouseDownTarget: HTMLDivElement | null = null;

  const onBackgroundClick = (event: MouseEvent) => {
    if (mouseDownTarget?.closest(".modal")) return;
    props.close?.()
  }


  return (
    <div class={styles.backgroundContainer} onclick={onBackgroundClick} onMouseDown={e => mouseDownTarget = e.target as any}>
      <DesktopProfileFlyout mobile close={props.close} serverId={props.serverId} userId={props.userId} />
    </div>
  )
}






function FlyoutTitle(props: { style?: JSX.CSSProperties, icon: string, title: string }) {
  return (
    <div class={styles.flyoutTitle} style={props.style}>
      <Icon color='var(--primary-color)' name={props.icon} size={14} />
      <Text size={13}>{props.title}</Text>
    </div>
  )
}



const UserActivity = (props: {userId: string}) => {
  const {users} = useStore();
  const user = () => users.get(props.userId);
  const activity = () => user()?.presence?.activity;
  const [playedFor, setPlayedFor] = createSignal("");

  createEffect(on(activity, () => {
    if (!activity()) return;

    setPlayedFor(calculateTimeElapsedForActivityStatus(activity()?.startedAt!));
    const intervalId = setInterval(() => {
      setPlayedFor(calculateTimeElapsedForActivityStatus(activity()?.startedAt!));
    }, 1000)

    onCleanup(() => {
      clearInterval(intervalId);
      
    })
  }))

  return (
    <Show when={activity()}>
      <div class={styles.userActivityContainer}>
        <Icon class={styles.icon} name='games' size={14} color='var(--primary-color)' />
        <div class={styles.activityInfo}>
          <div class={styles.activityInfoRow}>
            <Text size={13}>{activity()?.action}</Text>
            <Text size={13} opacity={0.6}>{activity()?.name}</Text>
          </div>
          <Text size={13}>For {playedFor()}</Text>
        </div>
      </div>
    </Show>
  )

}


